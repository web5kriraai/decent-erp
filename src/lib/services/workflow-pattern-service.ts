import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import type { Priority } from "@prisma/client";

export type WorkflowPatternTaskInput = {
  processId: number;
  subProcessId: number;
  defaultRoleId: number;
  expectedMinutes: number;
  sequence: number;
  dayOffset?: number;
  priority?: Priority;
  dependencySequence?: number | null;
};

export type CreateWorkflowPatternInput = {
  name: string;
  productTypeId?: number | null;
  versionNo?: number;
  tasks: WorkflowPatternTaskInput[];
};

export async function getWorkflowPatterns(options?: { includeInactive?: boolean }) {
  return prisma.workflowPattern.findMany({
    where: options?.includeInactive ? undefined : { active: true },
    orderBy: [{ name: "asc" }, { versionNo: "desc" }],
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          process: { select: { id: true, code: true, name: true } },
          subProcess: { select: { id: true, code: true, name: true } },
          defaultRole: { select: { id: true, code: true, name: true } },
        },
      },
      productType: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function validatePatternTasks(tasks: WorkflowPatternTaskInput[]) {
  if (tasks.length === 0) {
    throw new ApiError("At least one task step is required", 422);
  }

  const sequences = tasks.map((t) => t.sequence);
  if (new Set(sequences).size !== sequences.length) {
    throw new ApiError("Task sequence values must be unique", 422);
  }

  for (const task of tasks) {
    const subProcess = await prisma.designSubProcessMaster.findFirst({
      where: {
        id: task.subProcessId,
        processId: task.processId,
        active: true,
      },
    });
    if (!subProcess) {
      throw new ApiError(
        `Sub-process ${task.subProcessId} does not belong to process ${task.processId}`,
        422,
      );
    }

    const role = await prisma.role.findUnique({ where: { id: task.defaultRoleId } });
    if (!role) {
      throw new ApiError(`Role ${task.defaultRoleId} not found`, 422);
    }

    if (task.expectedMinutes <= 0) {
      throw new ApiError("Expected minutes must be greater than zero", 422);
    }
  }
}

export async function createWorkflowPattern(
  input: CreateWorkflowPatternInput,
  userId: number,
  correlationId: string,
) {
  const name = input.name.trim();
  if (!name) {
    throw new ApiError("Pattern name is required", 422);
  }

  const versionNo = input.versionNo ?? 1;

  if (input.productTypeId != null) {
    const productType = await prisma.productType.findUnique({
      where: { id: input.productTypeId },
    });
    if (!productType) {
      throw new ApiError("Product type not found", 422);
    }
  }

  await validatePatternTasks(input.tasks);

  const pattern = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowPattern.create({
      data: {
        name,
        productTypeId: input.productTypeId ?? null,
        versionNo,
        active: true,
        tasks: {
          create: input.tasks.map((task) => ({
            processId: task.processId,
            subProcessId: task.subProcessId,
            defaultRoleId: task.defaultRoleId,
            expectedMinutes: task.expectedMinutes,
            sequence: task.sequence,
            dayOffset: task.dayOffset ?? 0,
            priority: task.priority ?? "MEDIUM",
            dependencySequence: task.dependencySequence ?? null,
          })),
        },
      },
      include: {
        tasks: {
          orderBy: { sequence: "asc" },
          include: {
            process: { select: { id: true, code: true, name: true } },
            subProcess: { select: { id: true, code: true, name: true } },
            defaultRole: { select: { id: true, code: true, name: true } },
          },
        },
        productType: { select: { id: true, code: true, name: true } },
      },
    });

    return created;
  });

  await writeAuditLogDirect({
    entityType: "WorkflowPattern",
    entityId: String(pattern.id),
    action: "CREATE",
    userId,
    correlationId,
    after: pattern,
  });

  return pattern;
}

export async function updateWorkflowPatternTasks(
  id: number,
  tasks: WorkflowPatternTaskInput[],
  userId: number,
  correlationId: string,
) {
  const existing = await prisma.workflowPattern.findUnique({
    where: { id },
    include: { tasks: { orderBy: { sequence: "asc" } } },
  });
  if (!existing) throw new ApiError("Workflow pattern not found", 404);

  await validatePatternTasks(tasks);

  const pattern = await prisma.$transaction(async (tx) => {
    await tx.workflowPatternTask.deleteMany({ where: { workflowPatternId: id } });
    await tx.workflowPatternTask.createMany({
      data: tasks.map((task) => ({
        workflowPatternId: id,
        processId: task.processId,
        subProcessId: task.subProcessId,
        defaultRoleId: task.defaultRoleId,
        expectedMinutes: task.expectedMinutes,
        sequence: task.sequence,
        dayOffset: task.dayOffset ?? 0,
        priority: task.priority ?? "MEDIUM",
        dependencySequence: task.dependencySequence ?? null,
      })),
    });

    return tx.workflowPattern.findUniqueOrThrow({
      where: { id },
      include: {
        tasks: {
          orderBy: { sequence: "asc" },
          include: {
            process: { select: { id: true, code: true, name: true } },
            subProcess: { select: { id: true, code: true, name: true } },
            defaultRole: { select: { id: true, code: true, name: true } },
          },
        },
        productType: { select: { id: true, code: true, name: true } },
      },
    });
  });

  await writeAuditLogDirect({
    entityType: "WorkflowPattern",
    entityId: String(id),
    action: "UPDATE_TASKS",
    userId,
    correlationId,
    before: existing.tasks,
    after: pattern.tasks,
  });

  return pattern;
}

export async function updateWorkflowPattern(
  id: number,
  input: { name?: string; active?: boolean; versionNo?: number },
  userId: number,
  correlationId: string,
) {
  const existing = await prisma.workflowPattern.findUnique({ where: { id } });
  if (!existing) throw new ApiError("Workflow pattern not found", 404);

  const pattern = await prisma.workflowPattern.update({
    where: { id },
    data: input,
    include: {
      tasks: { orderBy: { sequence: "asc" } },
      productType: { select: { id: true, code: true, name: true } },
    },
  });

  await writeAuditLogDirect({
    entityType: "WorkflowPattern",
    entityId: String(id),
    action: "UPDATE",
    userId,
    correlationId,
    before: existing,
    after: pattern,
  });

  return pattern;
}

export async function cloneWorkflowPattern(
  sourceId: number,
  userId: number,
  correlationId: string,
) {
  const source = await prisma.workflowPattern.findUnique({
    where: { id: sourceId },
    include: { tasks: { orderBy: { sequence: "asc" } } },
  });
  if (!source) throw new ApiError("Workflow pattern not found", 404);
  if (source.tasks.length === 0) {
    throw new ApiError("Cannot clone a pattern with no task steps", 422);
  }

  const nextVersion = source.versionNo + 1;

  const pattern = await prisma.$transaction(async (tx) => {
    await tx.workflowPattern.update({
      where: { id: sourceId },
      data: { active: false },
    });

    return tx.workflowPattern.create({
      data: {
        name: source.name,
        productTypeId: source.productTypeId,
        versionNo: nextVersion,
        active: true,
        tasks: {
          create: source.tasks.map((task) => ({
            processId: task.processId,
            subProcessId: task.subProcessId,
            defaultRoleId: task.defaultRoleId,
            expectedMinutes: task.expectedMinutes,
            sequence: task.sequence,
            dayOffset: task.dayOffset,
            priority: task.priority,
            dependencySequence: task.dependencySequence,
          })),
        },
      },
      include: {
        tasks: {
          orderBy: { sequence: "asc" },
          include: {
            process: { select: { id: true, code: true, name: true } },
            subProcess: { select: { id: true, code: true, name: true } },
            defaultRole: { select: { id: true, code: true, name: true } },
          },
        },
        productType: { select: { id: true, code: true, name: true } },
      },
    });
  });

  await writeAuditLogDirect({
    entityType: "WorkflowPattern",
    entityId: String(pattern.id),
    action: "CLONE",
    userId,
    correlationId,
    before: { sourceId, sourceVersion: source.versionNo },
    after: pattern,
  });

  return pattern;
}
