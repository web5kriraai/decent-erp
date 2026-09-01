import type { Prisma } from "@prisma/client";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";
import { effectiveDependencySequence } from "@/lib/services/task-dependency";

type UnlockFromTask = {
  id: bigint;
  designId: bigint;
  dependencySequence: number | null;
  sequence: number;
};

type UnlockCandidate = {
  id: bigint;
  assignedEmployeeId: number | null;
  assignedRoleId: number;
  dependencySequence: number | null;
  sequence: number;
  status: string;
};

/**
 * Promote PENDING peers at the immediate next dependency sequence to ASSIGNED
 * and notify each assignee. Resolves an employee from role when none is set yet.
 */
export async function unlockNextDependentTasks(
  tx: Prisma.TransactionClient,
  fromTask: UnlockFromTask,
  correlationId: string,
): Promise<bigint[]> {
  const fromSeq = effectiveDependencySequence(fromTask);

  const candidates = (await tx.designTask.findMany({
    where: {
      designId: fromTask.designId,
      id: { not: fromTask.id },
      status: "PENDING",
      OR: [
        { dependencySequence: { gt: fromSeq } },
        { dependencySequence: null, sequence: { gt: fromSeq } },
      ],
    },
    orderBy: [{ dependencySequence: "asc" }, { sequence: "asc" }],
    select: {
      id: true,
      assignedEmployeeId: true,
      assignedRoleId: true,
      dependencySequence: true,
      sequence: true,
      status: true,
    },
  })) as UnlockCandidate[];

  if (candidates.length === 0) return [];

  const nextSeq = Math.min(...candidates.map((c) => effectiveDependencySequence(c)));
  const peers = candidates.filter((c) => effectiveDependencySequence(c) === nextSeq);
  const unlockedIds: bigint[] = [];

  for (const peer of peers) {
    let assigneeId = peer.assignedEmployeeId;
    if (!assigneeId) {
      assigneeId = await resolveEmployeeForRole(peer.assignedRoleId);
    }

    await tx.designTask.update({
      where: { id: peer.id },
      data: {
        status: "ASSIGNED",
        assignedEmployeeId: assigneeId,
        version: { increment: 1 },
      },
    });
    unlockedIds.push(peer.id);

    if (assigneeId != null) {
      await enqueueOutboxAndNotify(
        "TASK_ASSIGNED",
        { taskId: peer.id.toString(), employeeId: assigneeId },
        correlationId,
      );
    }
  }

  return unlockedIds;
}
