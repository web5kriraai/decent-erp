import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { initialStatusForCreate, isTaskReady } from "@/lib/services/task-dependency";
import { priorityRank } from "@/lib/task-priority";

type ReadinessTask = {
  id: bigint;
  designId: bigint;
  dependencySequence: number | null;
  sequence: number;
  status: string;
  assignedEmployeeId: number | null;
};

type ReadinessSibling = {
  id: bigint;
  dependencySequence: number | null;
  sequence: number;
  status: string;
};

const siblingSelect = {
  id: true,
  dependencySequence: true,
  sequence: true,
  status: true,
} as const;

function toDepSeqTask(task: ReadinessTask | ReadinessSibling) {
  return {
    id: task.id.toString(),
    dependencySequence: task.dependencySequence,
    sequence: task.sequence,
    status: task.status,
  };
}

/** Promote a single PENDING task to ASSIGNED when dependencies are satisfied. */
export async function promoteReadyPendingTaskInTx(
  tx: Prisma.TransactionClient,
  task: ReadinessTask,
  siblings: ReadinessSibling[],
  actorId: number,
  correlationId: string,
): Promise<ReadinessTask> {
  if (task.status !== "PENDING" || task.assignedEmployeeId == null) {
    return task;
  }
  if (!isTaskReady(toDepSeqTask(task), siblings.map(toDepSeqTask))) {
    return task;
  }

  const updated = await tx.designTask.update({
    where: { id: task.id },
    data: { status: "ASSIGNED", version: { increment: 1 } },
  });

  await writeAuditLog(tx, {
    entityType: "DesignTask",
    entityId: task.id.toString(),
    action: "PROMOTE_READY",
    userId: actorId,
    correlationId,
    before: task,
    after: updated,
  });

  return { ...task, status: "ASSIGNED" };
}

/**
 * Demote ASSIGNED tasks whose prior stages are no longer satisfied
 * (e.g. Costing unlocked early, then Sample Checking went to correction).
 */
export async function demoteBlockedAssignedTaskInTx(
  tx: Prisma.TransactionClient,
  task: ReadinessTask,
  siblings: ReadinessSibling[],
  actorId: number,
  correlationId: string,
): Promise<ReadinessTask> {
  if (task.status !== "ASSIGNED") {
    return task;
  }
  if (isTaskReady(toDepSeqTask(task), siblings.map(toDepSeqTask))) {
    return task;
  }

  const updated = await tx.designTask.update({
    where: { id: task.id },
    data: { status: "PENDING", version: { increment: 1 } },
  });

  await writeAuditLog(tx, {
    entityType: "DesignTask",
    entityId: task.id.toString(),
    action: "DEMOTE_NOT_READY",
    userId: actorId,
    correlationId,
    before: task,
    after: updated,
  });

  return { ...task, status: "PENDING" };
}

export async function reconcileTaskReadiness(
  taskId: bigint,
  actorId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) return null;

    const siblings = await tx.designTask.findMany({
      where: { designId: task.designId },
      select: siblingSelect,
    });

    return promoteReadyPendingTaskInTx(tx, task, siblings, actorId, correlationId);
  });
}

/** Align open task priorities with their design when design is more urgent. */
export async function syncOpenTaskPrioritiesForEmployee(employeeId: number): Promise<number> {
  const rows = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      priority: true,
      design: { select: { priority: true } },
    },
  });

  let updated = 0;
  for (const row of rows) {
    const designPriority = row.design.priority;
    if (priorityRank(designPriority) >= priorityRank(row.priority)) continue;
    await prisma.designTask.update({
      where: { id: row.id },
      data: { priority: designPriority },
    });
    updated += 1;
  }
  return updated;
}

export async function reconcileEmployeeTasksReadiness(
  employeeId: number,
  correlationId: string,
): Promise<number> {
  await syncOpenTaskPrioritiesForEmployee(employeeId);

  const openTasks = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: ["PENDING", "ASSIGNED"] },
    },
    select: {
      id: true,
      designId: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      assignedEmployeeId: true,
    },
  });
  if (openTasks.length === 0) return 0;

  const designIds = [...new Set(openTasks.map((t) => t.designId.toString()))];
  const siblingsByDesign = new Map<string, ReadinessSibling[]>();

  for (const designIdStr of designIds) {
    const siblings = await prisma.designTask.findMany({
      where: { designId: BigInt(designIdStr) },
      select: siblingSelect,
    });
    siblingsByDesign.set(designIdStr, siblings);
  }

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const task of openTasks) {
      const siblings = siblingsByDesign.get(task.designId.toString()) ?? [];
      const before = task.status;

      if (task.status === "ASSIGNED") {
        const result = await demoteBlockedAssignedTaskInTx(
          tx,
          task,
          siblings,
          employeeId,
          correlationId,
        );
        if (before === "ASSIGNED" && result.status === "PENDING") {
          changed += 1;
          // Keep local sibling snapshot in sync for later tasks in the same design
          const list = siblingsByDesign.get(task.designId.toString());
          const row = list?.find((s) => s.id === task.id);
          if (row) row.status = "PENDING";
        }
        continue;
      }

      const result = await promoteReadyPendingTaskInTx(
        tx,
        task,
        siblings,
        employeeId,
        correlationId,
      );
      if (before === "PENDING" && result.status === "ASSIGNED") {
        changed += 1;
        const list = siblingsByDesign.get(task.designId.toString());
        const row = list?.find((s) => s.id === task.id);
        if (row) row.status = "ASSIGNED";
      }
    }
  });

  return changed;
}

export function resolveStatusAfterAssign(input: {
  currentStatus: string;
  hasAssignee: boolean;
  isReady: boolean;
}): "PENDING" | "ASSIGNED" {
  if (!["PENDING", "ASSIGNED"].includes(input.currentStatus)) {
    return input.currentStatus as "PENDING" | "ASSIGNED";
  }
  return initialStatusForCreate({
    hasAssignee: input.hasAssignee,
    isReady: input.isReady,
  });
}
