import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { autoAdvanceConceptReview } from "@/lib/services/concept-review-auto-advance";
import { ApiError } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule } from "@/lib/errors/create-app-error";
import type { AssignmentMode, Priority, Prisma, WorkType } from "@prisma/client";
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
import {
  resolveManualDueAt,
  type TaskDateMode,
} from "@/lib/services/task-date-mode";
import { resolveAssigneesForPatternTasks } from "@/lib/services/assignment-service";
import { requireMasterOfType } from "@/lib/services/master-catalog-service";
import { MASTER_TYPES } from "@/lib/master-catalog-types";
import { ROLE_CODES } from "@/lib/permissions";

/** Ensures the employee is active and holds Design Head role (workflow portfolio owner). */
export async function assertActiveDesignHead(employeeId: number) {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      active: true,
      role: { code: ROLE_CODES.DESIGN_HEAD },
    },
    select: { id: true, name: true },
  });
  if (!employee) {
    throw new ApiError(
      "Selected Design Head must be an active employee with the Design Head role",
      400,
    );
  }
  return employee;
}

/**
 * Resolve which Design Head owns a new concept.
 * Explicit id wins; otherwise session Design Head defaults to self; others must pick.
 */
export function resolveCreateDesignHeadEmployeeId(input: {
  requestedId?: number | null;
  sessionEmployeeId: number;
  sessionRoleCode?: string | null;
}): number {
  if (input.requestedId != null && Number.isFinite(input.requestedId) && input.requestedId > 0) {
    return input.requestedId;
  }
  if (input.sessionRoleCode === ROLE_CODES.DESIGN_HEAD) {
    return input.sessionEmployeeId;
  }
  throw new ApiError(
    "Design Head is required. Select which Design Head owns this workflow.",
    400,
  );
}

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
  designGradeId?: number;
  fabricId?: number;
  machineId?: number;
  stitchingTypeId?: number;
  estimatedCost?: number;
  standardCost?: number;
  processId?: number;
  subProcessId?: number;
  assignmentMode: AssignmentMode;
  workflowPatternId?: number;
  taskDateMode?: TaskDateMode;
  manualTasks?: Array<{
    processId: number;
    subProcessId: number;
    assignedEmployeeId?: number;
    expectedMinutes: number;
    sequence?: number;
    dueAt?: string | Date;
    priority?: Priority;
  }>;
  componentTypeIds?: number[];
  componentSpecs?: Record<string, string>;
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
  await requireMasterOfType(input.productTypeId, MASTER_TYPES.PRODUCT_CATEGORY);
  await requireMasterOfType(input.seasonId, MASTER_TYPES.SEASON);
  if (input.fabricId != null) {
    await requireMasterOfType(input.fabricId, MASTER_TYPES.FABRIC_QUALITY);
  }
  if (input.machineId != null) {
    await requireMasterOfType(input.machineId, MASTER_TYPES.MACHINE);
  }
  if (input.stitchingTypeId != null) {
    await requireMasterOfType(input.stitchingTypeId, MASTER_TYPES.STITCHING_TYPE);
  }
  if (input.designGradeId != null) {
    await requireMasterOfType(input.designGradeId, MASTER_TYPES.DESIGN_GRADE);
  }
  if (input.componentTypeIds?.length) {
    await Promise.all(
      input.componentTypeIds.map((id) =>
        requireMasterOfType(id, MASTER_TYPES.PRODUCT_COMPONENT),
      ),
    );
  }
  await assertActiveDesignHead(input.designHeadEmployeeId);

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
        designGradeId: input.designGradeId,
        fabricId: input.fabricId,
        machineId: input.machineId,
        stitchingTypeId: input.stitchingTypeId,
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
        taskDateMode: input.taskDateMode ?? "SEQUENTIAL",
      });
    }

    if (input.manualTasks?.length) {
      const base = new Date();
      const subProcesses = await Promise.all(
        input.manualTasks.map((mt) =>
          tx.designSubProcessMaster.findUniqueOrThrow({
            where: { id: mt.subProcessId },
          }),
        ),
      );

      const autoAssigneeInputs = input.manualTasks
        .map((mt, index) => ({ mt, subProcess: subProcesses[index] }))
        .filter(({ mt }) => mt.assignedEmployeeId == null)
        .map(({ subProcess }) => ({
          defaultRoleId: subProcess.defaultRoleId ?? 1,
          defaultSkillId: null as number | null,
        }));

      const autoAssignees =
        autoAssigneeInputs.length > 0
          ? await resolveAssigneesForPatternTasks(autoAssigneeInputs, { tx })
          : [];

      let autoIndex = 0;
      for (let i = 0; i < input.manualTasks.length; i++) {
        const mt = input.manualTasks[i];
        const subProcess = subProcesses[i];
        const seq = mt.sequence ?? i + 1;
        const dueAt = resolveManualDueAt(mt.dueAt, base, mt.expectedMinutes);
        const assignedEmployeeId = mt.assignedEmployeeId
          ? mt.assignedEmployeeId
          : (autoAssignees[autoIndex++] ?? undefined);
        tasksToCreate.push({
          designId: design.id,
          processId: mt.processId,
          subProcessId: mt.subProcessId,
          assignedEmployeeId,
          assignedRoleId: subProcess.defaultRoleId ?? 1,
          expectedMinutes: mt.expectedMinutes,
          priority: mt.priority ?? input.priority,
          sequence: seq,
          dependencySequence: seq,
          plannedStart: base,
          dueAt,
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
      const specs: Record<number, string | undefined> = {};
      if (input.componentSpecs) {
        for (const [key, value] of Object.entries(input.componentSpecs)) {
          specs[Number(key)] = value;
        }
      }
      await createDesignComponents(tx, design.id, input.componentTypeIds, specs);
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

    return activatedDesign;
  }).then(async (design) => {
    // Single post-commit outbox + queue job (avoid duplicate in-tx outbox rows).
    await enqueueOutboxAndNotify(
      "DESIGN_CREATED",
      { designId: design.id.toString(), ideaRef: design.ideaRef },
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
  await reconcileStuckWorkflowTasks(id, options?.viewerEmployeeId);

  const correctionScope =
    options?.viewerEmployeeId != null
      ? buildCorrectionScopeForEmployee(options.viewerEmployeeId)
      : undefined;

  const design = await prisma.designConcept.findUnique({
    where: { id },
    include: {
      productType: true,
      season: true,
      fabric: true,
      machine: true,
      stitchingType: true,
      designGrade: true,
      designHead: { select: { id: true, name: true } },
      components: { include: { componentType: true } },
      images: true,
      costs: {
        select: {
          id: true,
          amount: true,
          costType: true,
          costCategory: true,
          description: true,
          enteredById: true,
          enteredAtUtc: true,
        },
        take: 200,
      },
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          assignedEmployee: { select: { id: true, name: true } },
          process: true,
          subProcess: {
            include: { defaultRole: { select: { id: true, code: true, name: true } } },
          },
          artifacts: {
            orderBy: { uploadedAtUtc: "desc" },
            select: {
              id: true,
              artifactType: true,
              stitchCount: true,
              machineFormat: true,
              sampleQty: true,
              wastageQty: true,
              fileName: true,
              storageKey: true,
              contentType: true,
              uploadedAtUtc: true,
            },
          },
          timeEvents: {
            orderBy: { eventTimeUtc: "desc" },
            take: 30,
            select: {
              id: true,
              eventType: true,
              eventTimeUtc: true,
              holdReasonId: true,
              remark: true,
              holdReason: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      corrections: {
        where: correctionScope,
        orderBy: { createdAtUtc: "desc" },
        include: {
          raisedBy: { select: { id: true, name: true } },
          responsibleEmployee: { select: { id: true, name: true } },
          reworkAssignee: { select: { id: true, name: true } },
          routeToSubProcess: { select: { id: true, code: true, name: true } },
        },
      },
      approvals: {
        orderBy: { id: "asc" },
        include: {
          level: { select: { id: true, name: true, sequence: true, code: true } },
          approver: { select: { id: true, name: true } },
        },
      },
      productionHandoffs: { orderBy: { releasedAtUtc: "desc" }, take: 5 },
      creativityRatings: {
        include: {
          employee: { select: { id: true, name: true } },
          ratedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!design) throw new ApiError("Design not found", 404);

  const totalTasks = design.tasks.length;
  const completedTasks = design.tasks.filter((t) => t.status === "COMPLETED").length;
  const activeTask =
    design.tasks.find((t) =>
      ["RUNNING", "ASSIGNED", "CHECKING", "ON_HOLD", "CORRECTION_REQUIRED"].includes(t.status),
    ) ?? design.tasks.find((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED");
  const costTotal = design.costs.reduce((s, c) => s + Number(c.amount), 0);
  const correctionCost = design.costs
    .filter((c) => c.costType === "CORRECTION")
    .reduce((s, c) => s + Number(c.amount), 0);
  const baseline =
    design.estimatedCost != null
      ? Number(design.estimatedCost)
      : design.standardCost != null
        ? Number(design.standardCost)
        : null;
  const marginPercent =
    baseline != null && baseline > 0
      ? Math.round(((baseline - costTotal) / baseline) * 1000) / 10
      : null;

  const { attachCorrectionTimeBreakdowns } = await import(
    "@/lib/services/correction-time-service"
  );
  const correctionsWithTime = await attachCorrectionTimeBreakdowns(design.corrections);

  return {
    ...design,
    corrections: correctionsWithTime,
    detailMeta: {
      progressPercent: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completedTasks,
      totalTasks,
      currentOwner: activeTask?.assignedEmployee ?? null,
      dueAt: activeTask?.dueAt ?? null,
      costSummary: {
        estimatedCost: design.estimatedCost != null ? Number(design.estimatedCost) : null,
        standardCost: design.standardCost != null ? Number(design.standardCost) : null,
        totalDevCost: costTotal,
        correctionCost,
        marginPercent,
      },
    },
  };
}

/**
 * Repair designs where a prior stage is satisfied but the next task stayed PENDING.
 * Also heals PROD_RELEASE stuck in CHECKING (LIVE_REVIEW was wrongly treated as a gate).
 */
async function reconcileStuckWorkflowTasks(
  designId: bigint,
  viewerEmployeeId?: number,
): Promise<void> {
  const correlationId = `workflow-reconcile-${designId.toString()}`;

  let actorId = viewerEmployeeId;
  if (actorId == null) {
    const design = await prisma.designConcept.findUnique({
      where: { id: designId },
      select: { designHeadEmployeeId: true },
    });
    actorId = design?.designHeadEmployeeId ?? undefined;
  }
  if (actorId != null) {
    const { healStuckProdReleaseChecking } = await import(
      "@/lib/services/production-service"
    );
    await healStuckProdReleaseChecking(designId, actorId, `${correlationId}-heal`);
  }

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
    designGradeId?: number | null;
    fabricId?: number | null;
    machineId?: number | null;
    stitchingTypeId?: number | null;
    targetGrade?: string | null;
    designHeadEmployeeId?: number;
    version: number;
  },
  userId: number,
  correlationId: string,
) {
  if (data.fabricId != null) {
    await requireMasterOfType(data.fabricId, MASTER_TYPES.FABRIC_QUALITY);
  }
  if (data.machineId != null) {
    await requireMasterOfType(data.machineId, MASTER_TYPES.MACHINE);
  }
  if (data.stitchingTypeId != null) {
    await requireMasterOfType(data.stitchingTypeId, MASTER_TYPES.STITCHING_TYPE);
  }
  if (data.designGradeId != null) {
    await requireMasterOfType(data.designGradeId, MASTER_TYPES.DESIGN_GRADE);
  }
  if (data.designHeadEmployeeId != null) {
    await assertActiveDesignHead(data.designHeadEmployeeId);
  }

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
        ...(data.designGradeId !== undefined ? { designGradeId: data.designGradeId } : {}),
        ...(data.fabricId !== undefined ? { fabricId: data.fabricId } : {}),
        ...(data.machineId !== undefined ? { machineId: data.machineId } : {}),
        ...(data.stitchingTypeId !== undefined ? { stitchingTypeId: data.stitchingTypeId } : {}),
        ...(data.targetGrade !== undefined ? { targetGrade: data.targetGrade } : {}),
        ...(data.designHeadEmployeeId !== undefined
          ? { designHeadEmployeeId: data.designHeadEmployeeId }
          : {}),
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

const EDITABLE_TASK_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CORRECTION_REQUIRED",
] as const;

export type DesignTaskScheduleUpdate = {
  taskId: string | bigint;
  dueAt?: string | Date | null;
  priority?: Priority;
  assignedEmployeeId?: number | null;
  expectedMinutes?: number;
};

/** Update due dates / assignees / priority on open workflow tasks for a design. */
export async function updateDesignTaskSchedule(
  designId: bigint,
  updates: DesignTaskScheduleUpdate[],
  userId: number,
  correlationId: string,
) {
  if (updates.length === 0) {
    throw new ApiError("At least one task update is required", 422);
  }

  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const changed: Array<{ taskId: string; fields: string[] }> = [];

    for (const update of updates) {
      const taskId = typeof update.taskId === "bigint" ? update.taskId : BigInt(update.taskId);
      const existing = await tx.designTask.findFirst({
        where: { id: taskId, designId },
      });
      if (!existing) {
        throw new ApiError(`Task ${String(taskId)} not found on this design`, 404);
      }
      if (!(EDITABLE_TASK_STATUSES as readonly string[]).includes(existing.status)) {
        throw new ApiError(
          `Cannot edit schedule for task in status ${existing.status}`,
          422,
        );
      }

      const data: {
        dueAt?: Date | null;
        priority?: Priority;
        assignedEmployeeId?: number | null;
        expectedMinutes?: number;
        version?: { increment: number };
      } = {};
      const fields: string[] = [];

      if (update.dueAt !== undefined) {
        data.dueAt =
          update.dueAt == null || update.dueAt === ""
            ? null
            : resolveManualDueAt(
                update.dueAt,
                existing.plannedStart ?? new Date(),
                update.expectedMinutes ?? existing.expectedMinutes,
              );
        fields.push("dueAt");
      }
      if (update.priority !== undefined) {
        data.priority = update.priority;
        fields.push("priority");
      }
      if (update.assignedEmployeeId !== undefined) {
        data.assignedEmployeeId = update.assignedEmployeeId;
        fields.push("assignedEmployeeId");
      }
      if (update.expectedMinutes !== undefined) {
        if (update.expectedMinutes <= 0) {
          throw new ApiError("Expected minutes must be greater than zero", 422);
        }
        data.expectedMinutes = update.expectedMinutes;
        fields.push("expectedMinutes");
      }

      if (fields.length === 0) continue;
      data.version = { increment: 1 };

      await tx.designTask.update({
        where: { id: taskId },
        data,
      });
      changed.push({ taskId: taskId.toString(), fields });
    }

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "UPDATE_TASK_SCHEDULE",
      userId,
      correlationId,
      after: { updates: changed },
    });

    return { updated: changed.length };
  });
}

/** Require at least one DesignImage marked primary before ACTIVE workflow work. */
export async function assertDesignHasPrimaryImage(
  designId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const primary = await client.designImage.findFirst({
    where: { designId, isPrimary: true },
    select: { id: true },
  });
  if (!primary) {
    throw businessRule(
      APP_ERROR_CODES.PRIMARY_IMAGE_REQUIRED,
      { designId: designId.toString() },
      "Upload at least one design image and mark it as primary before starting workflow tasks.",
    );
  }
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

    if (status === "ACTIVE" && existing.status !== "ACTIVE") {
      await assertDesignHasPrimaryImage(id, tx);
    }

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
      productType: { select: { name: true, code: true } },
      season: { select: { id: true, name: true } },
      designHead: { select: { id: true, name: true } },
      images: {
        where: { mediaKind: "IMAGE" },
        orderBy: [{ isPrimary: "desc" }, { uploadedAtUtc: "desc" }],
        take: 1,
        select: { storageKey: true, isPrimary: true },
      },
      corrections: {
        where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"] } },
        select: { id: true },
      },
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
          process: { select: { id: true, name: true, code: true } },
          subProcess: {
            select: {
              id: true,
              name: true,
              code: true,
              isApproval: true,
              isFileRequired: true,
              capabilities: true,
              defaultRole: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  });
}

function toNumberCost(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nearestOpenDueAt(
  tasks: Array<{ status: string; dueAt: Date | null }>,
): Date | null {
  const dates = tasks
    .filter(
      (t) =>
        t.dueAt != null &&
        !["COMPLETED", "CANCELLED", "SKIPPED"].includes(t.status),
    )
    .map((t) => t.dueAt as Date);
  if (dates.length === 0) return null;
  return dates.reduce((soonest, d) => (d < soonest ? d : soonest));
}

/**
 * Enriched kanban payload for the Design Workflow Dashboard:
 * cards + KPI summary (presigned primary image URLs included).
 */
export async function getDesignWorkflowDashboard(): Promise<{
  items: Array<Record<string, unknown>>;
  summary: {
    totalIdeas: number;
    createdThisMonth: number;
    underDevelopment: number;
    highPriorityInDev: number;
    correctionPending: number;
    delayedCount: number;
    approvedCount: number;
    approvalRate: number;
    releasedCount: number;
    estimatedCostSum: number;
    avgDevelopmentDays: number | null;
  };
}> {
  const { getPresignedDownloadUrl } = await import("@/lib/storage");
  const designs = await listDesignsForKanban();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const items = await Promise.all(
    designs.map(async (design) => {
      const primary = design.images[0];
      let primaryImageUrl: string | null = null;
      if (primary?.storageKey) {
        try {
          primaryImageUrl = await getPresignedDownloadUrl(primary.storageKey);
        } catch {
          primaryImageUrl = null;
        }
      }
      const dueAt = nearestOpenDueAt(design.tasks);
      const estimatedCost = toNumberCost(design.estimatedCost);
      const openCorrectionCount =
        design.corrections.length +
        design.tasks.filter((t) => t.status === "CORRECTION_REQUIRED").length;

      return {
        id: design.id.toString(),
        ideaRef: design.ideaRef,
        collectionName: design.collectionName,
        status: design.status,
        currentStage: design.currentStage,
        priority: design.priority,
        version: design.version,
        productType: {
          name: design.productType.name,
          code: design.productType.code,
        },
        designHead: { id: design.designHead.id, name: design.designHead.name },
        season: design.season
          ? { id: design.season.id, name: design.season.name }
          : null,
        estimatedCost,
        createdAtUtc: design.createdAtUtc.toISOString(),
        dueAt: dueAt ? dueAt.toISOString() : null,
        primaryImageUrl,
        openCorrectionCount,
        tasks: design.tasks,
      };
    }),
  );

  const totalIdeas = items.length;
  const createdThisMonth = items.filter(
    (d) => d.createdAtUtc && new Date(d.createdAtUtc) >= monthStart,
  ).length;
  const underDevelopment = items.filter((d) =>
    ["DRAFT", "ACTIVE", "APPROVAL_PENDING", "ON_HOLD"].includes(d.status),
  ).length;
  const highPriorityInDev = items.filter(
    (d) =>
      ["DRAFT", "ACTIVE", "APPROVAL_PENDING"].includes(d.status) &&
      (d.priority === "HIGH" || d.priority === "URGENT"),
  ).length;
  const correctionPending = items.filter(
    (d) =>
      (d.openCorrectionCount ?? 0) > 0 ||
      d.status === "ON_HOLD" ||
      String(d.currentStage ?? "").includes("CORRECTION"),
  ).length;
  const delayedCount = items.filter((d) => {
    if (!d.dueAt) return false;
    if (["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(d.status)) {
      return false;
    }
    return new Date(d.dueAt) < now;
  }).length;
  const approvedStatuses = [
    "APPROVED",
    "PRODUCTION_ACCEPTED",
    "PRODUCTION_RELEASED",
    "LIVE",
  ];
  const approvedCount = items.filter((d) => approvedStatuses.includes(d.status)).length;
  const releasedCount = items.filter((d) =>
    ["PRODUCTION_RELEASED", "LIVE"].includes(d.status),
  ).length;
  const approvalRate =
    totalIdeas > 0 ? Math.round((approvedCount / totalIdeas) * 100) : 0;
  const estimatedCostSum = items
    .filter((d) => ["PRODUCTION_RELEASED", "LIVE"].includes(d.status))
    .reduce((sum, d) => sum + (d.estimatedCost ?? 0), 0);

  const finished = designs.filter((d) =>
    ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(d.status),
  );
  let avgDevelopmentDays: number | null = null;
  if (finished.length > 0) {
    const days = finished.map((d) => {
      const end = d.updatedAtUtc.getTime();
      const start = d.createdAtUtc.getTime();
      return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    });
    avgDevelopmentDays =
      Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
  }

  return {
    items,
    summary: {
      totalIdeas,
      createdThisMonth,
      underDevelopment,
      highPriorityInDev,
      correctionPending,
      delayedCount,
      approvedCount,
      approvalRate,
      releasedCount,
      estimatedCostSum,
      avgDevelopmentDays,
    },
  };
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
      taskDateMode: "SEQUENTIAL",
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
