import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import type { AssignmentMode, Priority, WorkType } from "@prisma/client";
import {
  buildTasksFromPatternTasks,
  createDesignComponents,
  createDesignProcessInstances,
  generateDesignNumber,
  type TaskCreateRow,
} from "@/lib/services/task-generation-service";

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
) {
  return prisma.$transaction(async (tx) => {
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
      });
      tasksToCreate = await buildTasksFromPatternTasks(design.id, patternTasks, {
        firstAssigneeId: input.designHeadEmployeeId,
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
          plannedStart: base,
          dueAt: new Date(base.getTime() + mt.expectedMinutes * 60_000),
          status: mt.assignedEmployeeId ? ("ASSIGNED" as const) : ("PENDING" as const),
        });
      }
    }

    if (tasksToCreate.length === 0) {
      throw new ApiError("No tasks generated from workflow pattern or manual tasks", 422);
    }

    if (input.componentTypeIds?.length) {
      await createDesignComponents(tx, design.id, input.componentTypeIds);
    }

    await createDesignProcessInstances(tx, design.id, tasksToCreate);
    await tx.designTask.createMany({ data: tasksToCreate });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: design.id.toString(),
      action: "CREATE",
      userId: createdById,
      correlationId,
      after: design,
    });

    await tx.notificationOutbox.create({
      data: {
        eventType: "DESIGN_CREATED",
        payload: { designId: design.id.toString(), ideaRef: design.ideaRef },
      },
    });

    return design;
  }).then(async (design) => {
    await enqueueOutboxAndNotify(
      "DESIGN_CREATED",
      { designId: design.id.toString() },
      correlationId,
    );
    return design;
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

export async function getDesignById(id: bigint) {
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
      corrections: true,
      approvals: true,
      productionHandoffs: { orderBy: { releasedAtUtc: "desc" }, take: 5 },
    },
  });

  if (!design) throw new ApiError("Design not found", 404);
  return design;
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

export async function generateTasksFromPattern(
  designId: bigint,
  workflowPatternId: number,
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const patternTasks = await tx.workflowPatternTask.findMany({
      where: { workflowPatternId },
      orderBy: { sequence: "asc" },
    });

    if (patternTasks.length === 0) {
      throw new ApiError("Workflow pattern has no tasks", 422);
    }

    const tasksToCreate = await buildTasksFromPatternTasks(designId, patternTasks, {
      firstAssigneeId: design.designHeadEmployeeId,
    });

    await createDesignProcessInstances(tx, designId, tasksToCreate);
    await tx.designTask.createMany({ data: tasksToCreate });

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
