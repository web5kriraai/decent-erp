import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { initialStatusForCreate, isTaskReady } from "@/lib/services/task-dependency";

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

export async function reconcileEmployeeTasksReadiness(
  employeeId: number,
  correlationId: string,
): Promise<number> {
  const pending = await prisma.designTask.findMany({
    where: { assignedEmployeeId: employeeId, status: "PENDING" },
    select: {
      id: true,
      designId: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      assignedEmployeeId: true,
    },
  });
  if (pending.length === 0) return 0;

  const designIds = [...new Set(pending.map((t) => t.designId.toString()))];
  const siblingsByDesign = new Map<string, ReadinessSibling[]>();

  for (const designIdStr of designIds) {
    const siblings = await prisma.designTask.findMany({
      where: { designId: BigInt(designIdStr) },
      select: siblingSelect,
    });
    siblingsByDesign.set(designIdStr, siblings);
  }

  let promoted = 0;
  await prisma.$transaction(async (tx) => {
    for (const task of pending) {
      const siblings = siblingsByDesign.get(task.designId.toString()) ?? [];
      const before = task.status;
      const result = await promoteReadyPendingTaskInTx(
        tx,
        task,
        siblings,
        employeeId,
        correlationId,
      );
      if (before === "PENDING" && result.status === "ASSIGNED") promoted += 1;
    }
  });

  return promoted;
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
