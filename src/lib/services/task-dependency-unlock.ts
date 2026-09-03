import type { Prisma } from "@prisma/client";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";
import {
  effectiveDependencySequence,
  isDependencySatisfiedStatus,
} from "@/lib/services/task-dependency";
import { isProductionPostApprovalCode } from "@/lib/services/production-workflow";

type UnlockFromTask = {
  id: bigint;
  designId: bigint;
  dependencySequence: number | null;
  sequence: number;
  subProcessCode?: string;
};

export type UnlockPeerCandidate = {
  id: bigint | string;
  assignedEmployeeId?: number | null;
  assignedRoleId?: number;
  dependencySequence: number | null;
  sequence: number;
  status: string;
  subProcess?: { code: string; isApproval?: boolean } | null;
};

/**
 * Pick PENDING peers at the earliest incomplete dependency sequence after `fromTask`.
 * Never skips an incomplete mid-stage (e.g. Sample Checking ASSIGNED) to unlock Costing.
 */
export function selectUnlockPeerIds(
  fromTask: {
    id: bigint | string;
    dependencySequence: number | null;
    sequence: number;
    subProcessCode?: string;
  },
  siblings: UnlockPeerCandidate[],
  shouldSkipCandidate: (candidateCode: string) => boolean,
): Array<bigint | string> {
  const fromSeq = effectiveDependencySequence(fromTask);

  const later = siblings.filter(
    (s) =>
      String(s.id) !== String(fromTask.id) &&
      effectiveDependencySequence(s) > fromSeq &&
      !shouldSkipCandidate(s.subProcess?.code ?? ""),
  );

  if (later.length === 0) return [];

  const incomplete = later.filter((s) => !isDependencySatisfiedStatus(s.status));
  if (incomplete.length === 0) return [];

  const nextSeq = Math.min(...incomplete.map((s) => effectiveDependencySequence(s)));

  return incomplete
    .filter(
      (s) =>
        effectiveDependencySequence(s) === nextSeq && s.status === "PENDING",
    )
    .map((s) => s.id);
}

function productionSkipPredicate(fromCode: string | undefined) {
  return (candidateCode: string): boolean => {
    if (!isProductionPostApprovalCode(candidateCode)) return false;
    if (fromCode === "PROD_HANDOFF" && candidateCode === "PROD_INSTRUCTION") return true;
    if (fromCode === "PROD_INSTRUCTION" && candidateCode === "PROD_RELEASE") return false;
    if (fromCode === "PROD_RELEASE" && candidateCode === "LIVE_REVIEW") return false;
    return true;
  };
}

/**
 * Promote PENDING peers at the immediate next incomplete dependency sequence to ASSIGNED
 * and notify each assignee. Resolves an employee from role when none is set yet.
 * Does not skip incomplete mid-stages.
 */
export async function unlockNextDependentTasks(
  tx: Prisma.TransactionClient,
  fromTask: UnlockFromTask,
  correlationId: string,
): Promise<bigint[]> {
  const fromSeq = effectiveDependencySequence(fromTask);
  const shouldSkip = productionSkipPredicate(fromTask.subProcessCode);

  const siblings = (await tx.designTask.findMany({
    where: {
      designId: fromTask.designId,
      id: { not: fromTask.id },
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
      subProcess: { select: { code: true, isApproval: true } },
    },
  })) as UnlockPeerCandidate[];

  const peerIds = selectUnlockPeerIds(fromTask, siblings, shouldSkip);
  if (peerIds.length === 0) return [];

  const peers = siblings.filter((s) => peerIds.some((id) => String(id) === String(s.id)));
  const unlockedIds: bigint[] = [];

  for (const peer of peers) {
    let assigneeId = peer.assignedEmployeeId ?? null;
    if (!assigneeId && peer.assignedRoleId != null) {
      assigneeId = await resolveEmployeeForRole(peer.assignedRoleId);
    }

    const peerId = typeof peer.id === "bigint" ? peer.id : BigInt(peer.id);

    await tx.designTask.update({
      where: { id: peerId },
      data: {
        status: "ASSIGNED",
        assignedEmployeeId: assigneeId,
        version: { increment: 1 },
      },
    });
    unlockedIds.push(peerId);

    if (assigneeId != null) {
      await enqueueOutboxAndNotify(
        "TASK_ASSIGNED",
        {
          taskId: peerId.toString(),
          employeeId: assigneeId,
          isStageApproval: peer.subProcess?.isApproval === true,
        },
        correlationId,
      );
    }
  }

  return unlockedIds;
}
