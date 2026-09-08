import {
  isDependencySatisfiedStatus,
  isPriorPipelineStage,
  isTaskReady,
} from "@/lib/services/task-dependency";
import { findStageApprovalGate, resolveEffectiveTaskStatus } from "@/lib/services/workflow-stage-gate";
import {
  isStageApprovalActionableFromBehavior,
  resolveStageBehavior,
} from "@/lib/workflow/stage-behavior";

export type DepSibling = {
  id: string;
  dependencySequence: number | null;
  sequence: number;
  status: string;
  assignedEmployeeId?: number | null;
  subProcess?: { name: string; code: string; isApproval?: boolean } | null;
  assignedEmployee?: { name: string } | null;
};

export type MyTaskRow = {
  id: string;
  status: string;
  dependencySequence: number | null;
  sequence: number;
  subProcess?: { name: string; code: string; isApproval?: boolean } | null;
  assignedEmployeeId: number | null;
};

/** First prior pipeline stage that blocks readiness. */
export function findDependencyBlocker(task: MyTaskRow, siblings: DepSibling[]): DepSibling | null {
  const blockers = siblings
    .filter(
      (s) =>
        String(s.id) !== String(task.id) &&
        isPriorPipelineStage(s, task) &&
        !isDependencySatisfiedStatus(s.status),
    )
    .sort((a, b) => a.sequence - b.sequence);
  return blockers[0] ?? null;
}

export function findNextOpenTask(siblings: DepSibling[], afterSequence: number): DepSibling | null {
  return (
    siblings
      .filter((s) => s.sequence > afterSequence && !isDependencySatisfiedStatus(s.status))
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}

/** Work precursor stage for an approval task (e.g. SKETCH for SKETCH_APPROVAL). */
export function findApprovalWorkPrecursor(
  task: MyTaskRow,
  siblings: DepSibling[],
): DepSibling | null {
  if (!task.subProcess?.isApproval || !task.subProcess.code) return null;
  const behavior = resolveStageBehavior({
    code: task.subProcess.code,
    isApproval: true,
  });
  const precursorCode = behavior.workPrecursorCode;
  if (!precursorCode) return null;
  return siblings.find((s) => s.subProcess?.code === precursorCode) ?? null;
}

/** True when an approval stage is assigned but prior work is not yet submitted for checking. */
export function isBlockedByApprovalPrecursor(task: MyTaskRow, siblings: DepSibling[]): boolean {
  if (!task.subProcess?.isApproval || !task.subProcess.code) return false;
  const behavior = resolveStageBehavior({
    code: task.subProcess.code,
    isApproval: true,
  });
  if (!behavior.isApproval) return false;
  const work = findApprovalWorkPrecursor(task, siblings);
  return !isStageApprovalActionableFromBehavior(behavior, work);
}

function taskIsDependencyReady(task: MyTaskRow, siblings: DepSibling[]): boolean {
  return isTaskReady(
    {
      id: task.id,
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      status: task.status,
    },
    siblings,
  );
}

export type ActionCenterBucket =
  | "actionRequired"
  | "waitingForOthers"
  | "blocked"
  | "upcoming"
  | "completed";

/**
 * Personal My Tasks buckets:
 * - actionRequired — can work now (ready + approval precursor satisfied)
 * - blocked — assigned/pending work blocked by prior stage or approval precursor
 * - waitingForOthers — my work submitted / done; waiting on someone else (folded in UI)
 * - upcoming — not yet in the unlock path (no concrete blocker)
 * - completed — done for me
 */
export function categorizeEmployeeTask(
  task: MyTaskRow,
  siblings: DepSibling[],
): ActionCenterBucket {
  if (task.status === "COMPLETED") {
    const next = findNextOpenTask(siblings, task.sequence);
    if (next && next.status !== "COMPLETED") {
      return "waitingForOthers";
    }
    return "completed";
  }

  if (task.status === "CHECKING" && !task.subProcess?.isApproval) {
    return findStageApprovalGate(task, siblings) ? "waitingForOthers" : "completed";
  }

  if (task.status === "PENDING") {
    if (taskIsDependencyReady(task, siblings)) {
      if (isBlockedByApprovalPrecursor(task, siblings)) return "blocked";
      return "actionRequired";
    }
    // Any incomplete prior stage blocks this assignee's work (full-scoped Blocked tab).
    if (findDependencyBlocker(task, siblings)) return "blocked";
    return "upcoming";
  }

  if (
    task.status === "ASSIGNED" ||
    task.status === "RUNNING" ||
    task.status === "ON_HOLD" ||
    task.status === "CORRECTION_REQUIRED"
  ) {
    if (taskIsDependencyReady(task, siblings)) {
      if (isBlockedByApprovalPrecursor(task, siblings)) return "blocked";
      return "actionRequired";
    }
    return "blocked";
  }

  return "completed";
}

/** Personal Action Center: waiting-for-others folds to Completed when the assignee's work is effectively done. */
export function foldWaitingTaskToPersonalBucket(
  task: MyTaskRow,
  siblings: DepSibling[],
): "completed" | "upcoming" {
  const effectiveStatus = resolveEffectiveTaskStatus(task, siblings);
  return effectiveStatus === "COMPLETED" ? "completed" : "upcoming";
}

export function buildWaitingContext(
  task: MyTaskRow,
  siblings: DepSibling[],
  viewerEmployeeId?: number,
): { waitingFor: string; nextAction: string; nextTaskId?: string } {
  function linkableTaskId(taskId: string, assigneeId: number | null | undefined): string | undefined {
    if (viewerEmployeeId == null || assigneeId !== viewerEmployeeId) return undefined;
    return taskId;
  }

  if (task.status === "CHECKING") {
    const approval = findStageApprovalGate(task, siblings);
    if (approval) {
      return {
        waitingFor: approval.assignedEmployee?.name ?? "Approver",
        nextAction: approval.subProcess?.name ?? "Stage approval",
        nextTaskId: linkableTaskId(approval.id, approval.assignedEmployeeId),
      };
    }
    return {
      waitingFor: "Checker / approver",
      nextAction: "Review submitted work",
    };
  }

  if (task.status === "PENDING" || task.status === "ASSIGNED") {
    const blocker = findDependencyBlocker(task, siblings);
    if (blocker) {
      return {
        waitingFor: blocker.assignedEmployee?.name ?? "Prior stage owner",
        nextAction: blocker.subProcess?.name ?? "Prior stage",
        nextTaskId: linkableTaskId(blocker.id, blocker.assignedEmployeeId),
      };
    }
  }

  const next = findNextOpenTask(siblings, task.sequence);
  if (next) {
    return {
      waitingFor: next.assignedEmployee?.name ?? "Next assignee",
      nextAction: next.subProcess?.name ?? "Next stage",
      nextTaskId: linkableTaskId(next.id, next.assignedEmployeeId),
    };
  }

  return { waitingFor: "Workflow", nextAction: "Continue pipeline" };
}

function describeDependencyBlockMessage(blocker: DepSibling): string {
  const stageName = blocker.subProcess?.name ?? "Prior stage";
  const owner = blocker.assignedEmployee?.name;
  const statusLabel = blocker.status.replace(/_/g, " ").toLowerCase();
  if (blocker.status === "CORRECTION_REQUIRED") {
    return owner
      ? `${stageName} needs a correction before you can continue (${owner}).`
      : `${stageName} needs a correction before you can continue.`;
  }
  if (blocker.status === "CHECKING") {
    return owner
      ? `Waiting for ${stageName} to be checked (${owner}).`
      : `Waiting for ${stageName} to be checked.`;
  }
  return owner
    ? `${stageName} must finish first — waiting on ${owner} (${statusLabel}).`
    : `${stageName} must be completed first (currently ${statusLabel}).`;
}

function describeApprovalPrecursorBlockMessage(
  task: MyTaskRow,
  work: DepSibling | null,
): string {
  const code = task.subProcess?.code ?? "";
  const workName = work?.subProcess?.name ?? "prior work";
  const owner = work?.assignedEmployee?.name;
  const ownerSuffix = owner ? ` (${owner})` : "";
  if (work?.status === "ON_HOLD") {
    return `${workName} is on hold${ownerSuffix} — approval unlocks after they resume and submit.`;
  }
  if (work?.status === "ASSIGNED" || work?.status === "RUNNING") {
    return `Waiting for ${workName} to be submitted for checking${ownerSuffix}.`;
  }
  if (code === "LIVE_REVIEW") {
    return "Production Release must be completed before Live Design Review.";
  }
  return `Waiting for ${workName} to be submitted for checking${ownerSuffix}.`;
}

export function buildBlockedContext(
  task: MyTaskRow,
  siblings: DepSibling[],
): { blockedBy: string; blockedOwner?: string; blockedMessage: string } {
  const blocker = findDependencyBlocker(task, siblings);
  if (blocker) {
    return {
      blockedBy: blocker.subProcess?.name ?? "Prior stage",
      blockedOwner: blocker.assignedEmployee?.name,
      blockedMessage: describeDependencyBlockMessage(blocker),
    };
  }

  if (isBlockedByApprovalPrecursor(task, siblings)) {
    const work = findApprovalWorkPrecursor(task, siblings);
    return {
      blockedBy: work?.subProcess?.name ?? "Prior work",
      blockedOwner: work?.assignedEmployee?.name,
      blockedMessage: describeApprovalPrecursorBlockMessage(task, work),
    };
  }

  return {
    blockedBy: "Workflow dependency",
    blockedMessage: "This task is blocked by an incomplete prior stage.",
  };
}
