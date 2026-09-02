import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { autoAdvanceConceptReview } from "@/lib/services/concept-review-auto-advance";
import { ApiError } from "@/lib/api-utils";
import type { AssignmentMode, Priority, WorkType } from "@prisma/client";
import {
  applyCreateReadiness,
  buildTasksFromPatternTasks,
  createDesignComponents,
  createDesignProcessInstances,
  generateDesignNumber,
  toPrismaTaskCreateRows,
  type TaskCreateRow,
} from "@/lib/services/task-generation-service";
import {
  isDependencySatisfiedStatus,
} from "@/lib/services/task-dependency";
import { unlockNextDependentTasks } from "@/lib/services/task-dependency-unlock";
import { buildCorrectionScopeForEmployee } from "@/lib/services/correction-queue-utils";

export type CreateDesignInput = {
  productTypeId: number;
  collectionName: string;
  seasonId: number;
  designHeadEmployeeId: number;
  priority: Priority;
  conceptNote?: string;
  styleName?: string;
  workType?: WorkType;
  trendReference?: string;
  celebrityReference?: string;
  targetGrade?: string;
  estimatedCost?: number;
  standardCost?: number;
  processId?: number;
  subProcessId?: number;
  assignmentMode: AssignmentMode;
  workflowPatternId?: number;
  manualTasks?: Array<{
    processId: number;
    subProcessId: number;
    assignedEmployeeId?: number;
    expectedMinutes: number;
    sequence?: number;
  }>;
  componentTypeIds?: number[];
};

function generateIdeaRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IDEA-${ts}-${rand}`;
}

export async function createDesignWithTasks(
  input: CreateDesignInput,
  createdById: number,
  correlationId: string,
  actorRoleCode?: string,
) {
  return prisma.$transaction(async (tx) => {
    if (input.assignmentMode === "AUTOMATIC" && input.workflowPatternId) {
      const pattern = await tx.workflowPattern.findUnique({
        where: { id: input.workflowPatternId },
      });
      if (!pattern || !pattern.active) {
        throw new ApiError("Workflow pattern not found", 422);
      }
      if (pattern.productTypeId && pattern.productTypeId !== input.productTypeId) {
        throw new ApiError(
          "Selected workflow pattern does not apply to this product type",
          422,
        );
      }
    }

    const ideaRef = generateIdeaRef();
    const design = await tx.designConcept.create({
      data: {
        ideaRef,
        designNumber: generateDesignNumber(ideaRef),
        productTypeId: input.productTypeId,
        collectionName: input.collectionName,
        seasonId: input.seasonId,
        designHeadEmployeeId: input.designHeadEmployeeId,
        priority: input.priority,
        conceptNote: input.conceptNote,
        styleName: input.styleName,
        workType: input.workType,
        trendReference: input.trendReference,
        celebrityReference: input.celebrityReference,
        targetGrade: input.targetGrade,
        estimatedCost: input.estimatedCost,
        standardCost: input.standardCost,
        assignmentMode: input.assignmentMode,
        workflowPatternId: input.workflowPatternId,
        createdById,
        status: "DRAFT",
        currentStage: "CONCEPT",
      },
    });

    let tasksToCreate: TaskCreateRow[] = [];

    if (input.assignmentMode === "AUTOMATIC" && input.workflowPatternId) {
      const patternTasks = await tx.workflowPatternTask.findMany({
        where: { workflowPatternId: input.workflowPatternId },
        orderBy: { sequence: "asc" },
        include: { subProcess: { select: { isApproval: true } } },
      });
      tasksToCreate = await buildTasksFromPatternTasks(design.id, patternTasks, {
        firstAssigneeId: input.designHeadEmployeeId,
        designPriority: input.priority,
      });
    }

    if (input.manualTasks?.length) {
      const base = new Date();
      for (let i = 0; i < input.manualTasks.length; i++) {
        const mt = input.manualTasks[i];
        const subProcess = await tx.designSubProcessMaster.findUniqueOrThrow({
          where: { id: mt.subProcessId },
        });
        const seq = mt.sequence ?? i + 1;
        tasksToCreate.push({
          designId: design.id,
          processId: mt.processId,
          subProcessId: mt.subProcessId,
          assignedEmployeeId: mt.assignedEmployeeId,
          assignedRoleId: subProcess.defaultRoleId ?? 1,
          expectedMinutes: mt.expectedMinutes,
          priority: input.priority,
          sequence: seq,
          dependencySequence: seq,
          plannedStart: base,
          dueAt: new Date(base.getTime() + mt.expectedMinutes * 60_000),
          status: "PENDING",
          isApproval: subProcess.isApproval,
        });
      }
    }

    if (tasksToCreate.length === 0) {
      throw new ApiError("No tasks generated from workflow pattern or manual tasks", 422);
    }

    // Re-apply readiness across combined automatic + manual rows
    tasksToCreate = applyCreateReadiness(tasksToCreate);

    if (input.componentTypeIds?.length) {
      await createDesignComponents(tx, design.id, input.componentTypeIds);
    }

    await createDesignProcessInstances(tx, design.id, tasksToCreate);
    await tx.designTask.createMany({ data: toPrismaTaskCreateRows(tasksToCreate) });

    const firstReady =
      tasksToCreate.find((t) => t.status === "ASSIGNED") ?? tasksToCreate[0];
    const firstSubProcess = await tx.designSubProcessMaster.findUnique({
      where: { id: firstReady.subProcessId },
      select: { code: true, name: true },
    });

    const activatedDesign = await tx.designConcept.update({
      where: { id: design.id },
      data: {
        status: "ACTIVE",
        currentStage: firstSubProcess?.code ?? "CONCEPT",
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: design.id.toString(),
      action: "CREATE",
      userId: createdById,
      correlationId,
      after: activatedDesign,
    });

    await tx.notificationOutbox.create({
      data: {
        eventType: "DESIGN_CREATED",
        payload: { designId: design.id.toString(), ideaRef: design.ideaRef },
      },
    });

    return activatedDesign;
  }).then(async (design) => {
    await enqueueOutboxAndNotify(
      "DESIGN_CREATED",
      { designId: design.id.toString() },
      correlationId,
    );
    try {
      await autoAdvanceConceptReview(design.id, createdById, correlationId, {
        roleCode: actorRoleCode,
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          msg: "Concept review auto-advance skipped after design create",
          designId: design.id.toString(),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return prisma.designConcept.findUniqueOrThrow({ where: { id: design.id } });
  });
}

export async function listDesigns(filters: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where = {
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.search
      ? {
          OR: [
            { ideaRef: { contains: filters.search, mode: "insensitive" as const } },
            { collectionName: { contains: filters.search, mode: "insensitive" as const } },
            { designNumber: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.designConcept.findMany({
      where,
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      orderBy: { createdAtUtc: "desc" },
      include: {
        productType: true,
        season: true,
        designHead: { select: { id: true, name: true } },
      },
    }),
    prisma.designConcept.count({ where }),
  ]);

  return { items, total };
}

export async function getDesignById(id: bigint, options?: { viewerEmployeeId?: number }) {
  await reconcileStuckWorkflowTasks(id);

  const correctionScope =
    options?.viewerEmployeeId != null
      ? buildCorrectionScopeForEmployee(options.viewerEmployeeId)
      : undefined;

  const design = await prisma.designConcept.findUnique({
    where: { id },
    include: {
      productType: true,
      season: true,
      designHead: { select: { id: true, name: true } },
      components: { include: { componentType: true } },
      images: true,
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          assignedEmployee: { select: { id: true, name: true } },
          process: true,
          subProcess: true,
        },
      },
      corrections: {
        where: correctionScope,
        orderBy: { createdAtUtc: "desc" },
      },
      approvals: true,
      productionHandoffs: { orderBy: { releasedAtUtc: "desc" }, take: 5 },
    },
  });

  if (!design) throw new ApiError("Design not found", 404);
  return design;
}

/** Repair designs where a prior stage is satisfied but the next task stayed PENDING. */
async function reconcileStuckWorkflowTasks(designId: bigint): Promise<void> {
  const tasks = await prisma.designTask.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      designId: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      subProcess: { select: { code: true } },
    },
  });

  const hasStuckSuccessor = tasks.some((task, index) => {
    if (!isDependencySatisfiedStatus(task.status)) return false;
    const next = tasks[index + 1];
    return next?.status === "PENDING";
  });

  if (!hasStuckSuccessor) return;

  const correlationId = `workflow-reconcile-${designId.toString()}`;
  await prisma.$transaction(async (tx) => {
    for (const task of tasks) {
      if (!isDependencySatisfiedStatus(task.status)) continue;
      await unlockNextDependentTasks(
        tx,
        {
          id: task.id,
          designId: task.designId,
          dependencySequence: task.dependencySequence,
          sequence: task.sequence,
          subProcessCode: task.subProcess?.code,
        },
        correlationId,
      );
    }
  });
}

export async function updateDesign(
  id: bigint,
  data: {
    collectionName?: string;
    conceptNote?: string;
    priority?: Priority;
    styleName?: string;
    workType?: WorkType;
    trendReference?: string;
    celebrityReference?: string;
    version: number;
  },
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.designConcept.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Design not found", 404);
    if (existing.version !== data.version) {
      throw new ApiError("Concurrency conflict - refresh and retry", 409);
    }

    const updated = await tx.designConcept.update({
      where: { id },
      data: {
        collectionName: data.collectionName,
        conceptNote: data.conceptNote,
        priority: data.priority,
        styleName: data.styleName,
        workType: data.workType,
        trendReference: data.trendReference,
        celebrityReference: data.celebrityReference,
        version: { increment: 1 },
      },
    });

    if (data.priority && data.priority !== existing.priority) {
      await tx.designTask.updateMany({
        where: {
          designId: id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        data: { priority: data.priority },
      });
    }

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: id.toString(),
      action: "UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function updateDesignStatus(
  id: bigint,
  status: import("@prisma/client").DesignStatus,
  version: number,
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.designConcept.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Design not found", 404);
    if (existing.version !== version) {
      throw new ApiError("Concurrency conflict - refresh and retry", 409);
    }

    assertAllowedDesignStatusTransition(existing.status, status);

    const updated = await tx.designConcept.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: id.toString(),
      action: "STATUS_CHANGE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/** Kanban/API-safe transitions. Gate statuses (APPROVED / PRODUCTION_RELEASED / LIVE) use dedicated services. */
const DESIGN_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["ACTIVE", "ON_HOLD", "CLOSED"],
  ACTIVE: ["ON_HOLD", "APPROVAL_PENDING", "DRAFT", "CLOSED"],
  ON_HOLD: ["ACTIVE", "DRAFT", "CLOSED"],
  APPROVAL_PENDING: ["ACTIVE", "ON_HOLD", "REJECTED"],
  APPROVED: ["ON_HOLD", "CLOSED"],
  PRODUCTION_ACCEPTED: ["ON_HOLD", "CLOSED"],
  REJECTED: ["ACTIVE", "DRAFT", "CLOSED"],
  PRODUCTION_RELEASED: ["CLOSED"],
  LIVE: ["CLOSED"],
  CLOSED: [],
};

export function assertAllowedDesignStatusTransition(
  from: string,
  to: string,
): void {
  if (from === to) return;
  const allowed = DESIGN_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(
      `Cannot change design status from ${from} to ${to}. Use the approval or production release flows for gated transitions.`,
      422,
    );
  }
}

export async function listDesignsForKanban() {
  return prisma.designConcept.findMany({
    where: { status: { notIn: ["CLOSED", "REJECTED"] } },
    orderBy: { updatedAtUtc: "desc" },
    include: {
      productType: { select: { name: true } },
      designHead: { select: { name: true } },
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
          process: { select: { id: true, name: true, code: true } },
          subProcess: {
            select: { id: true, name: true, code: true, isApproval: true, isFileRequired: true },
          },
        },
      },
    },
  });
}

export async function generateTasksFromPattern(
  designId: bigint,
  workflowPatternId: number,
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const existingTaskCount = await tx.designTask.count({ where: { designId } });
    if (existingTaskCount > 0) {
      throw new ApiError("Design already has workflow tasks. Cannot regenerate from pattern.", 422);
    }

    const pattern = await tx.workflowPattern.findUnique({
      where: { id: workflowPatternId },
    });
    if (!pattern) throw new ApiError("Workflow pattern not found", 404);
    if (!pattern.active) {
      throw new ApiError("Workflow pattern is inactive and cannot be used", 422);
    }
    if (
      pattern.productTypeId != null &&
      pattern.productTypeId !== design.productTypeId
    ) {
      throw new ApiError(
        "Workflow pattern does not apply to this design's product type",
        422,
      );
    }

    const patternTasks = await tx.workflowPatternTask.findMany({
      where: { workflowPatternId },
      orderBy: { sequence: "asc" },
      include: { subProcess: { select: { isApproval: true } } },
    });

    if (patternTasks.length === 0) {
      throw new ApiError("Workflow pattern has no tasks", 422);
    }

    const tasksToCreate = await buildTasksFromPatternTasks(designId, patternTasks, {
      firstAssigneeId: design.designHeadEmployeeId,
      designPriority: design.priority,
    });

    await createDesignProcessInstances(tx, designId, tasksToCreate);
    await tx.designTask.createMany({ data: toPrismaTaskCreateRows(tasksToCreate) });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "GENERATE_TASKS",
      userId,
      correlationId,
      after: { workflowPatternId, taskCount: patternTasks.length },
    });
  });
}
