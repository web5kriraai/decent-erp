import {
  effectiveDependencySequence,
  isDependencySatisfiedStatus,
  isTaskReady,
} from "@/lib/services/task-dependency";
import { findStageApprovalGate } from "@/lib/services/workflow-stage-gate";

export { findStageApprovalGate } from "@/lib/services/workflow-stage-gate";

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

/** First prior-stage task that blocks readiness. */
export function findDependencyBlocker(task: MyTaskRow, siblings: DepSibling[]): DepSibling | null {
  const depSeq = effectiveDependencySequence(task);
  const blockers = siblings
    .filter(
      (s) =>
        String(s.id) !== String(task.id) &&
        effectiveDependencySequence(s) < depSeq &&
        !isDependencySatisfiedStatus(s.status),
    )
    .sort(
      (a, b) => effectiveDependencySequence(a) - effectiveDependencySequence(b),
    );
  return blockers[0] ?? null;
}

export function findNextOpenTask(siblings: DepSibling[], afterSequence: number): DepSibling | null {
  return siblings
    .filter((s) => s.sequence > afterSequence && !isDependencySatisfiedStatus(s.status))
    .sort((a, b) => a.sequence - b.sequence)[0] ?? null;
}

/** @deprecated Prefer findStageApprovalGate — kept for existing imports. */
export function findRelatedApprovalTask(
  workTask: MyTaskRow,
  siblings: DepSibling[],
): DepSibling | null {
  return findStageApprovalGate(workTask, siblings);
}

export type ActionCenterBucket =
  | "actionRequired"
  | "waitingForOthers"
  | "blocked"
  | "upcoming"
  | "completed";

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
    const ready = isTaskReady(
      {
        id: task.id,
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (ready) return "actionRequired";
    const blocker = findDependencyBlocker(task, siblings);
    if (blocker?.status === "CORRECTION_REQUIRED") {
      return "blocked";
    }
    if (blocker) {
      return "waitingForOthers";
    }
    return "upcoming";
  }

  if (
    task.status === "ASSIGNED" ||
    task.status === "RUNNING" ||
    task.status === "ON_HOLD" ||
    task.status === "CORRECTION_REQUIRED"
  ) {
    const ready = isTaskReady(
      {
        id: task.id,
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (ready) return "actionRequired";
    return "blocked";
  }

  return "completed";
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

  if (task.status === "PENDING") {
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

export function buildBlockedContext(
  task: MyTaskRow,
  siblings: DepSibling[],
): { blockedBy: string; blockedOwner?: string; blockedMessage: string } {
  const blocker = findDependencyBlocker(task, siblings);
  if (blocker) {
    const stageName = blocker.subProcess?.name ?? "Prior stage";
    const owner = blocker.assignedEmployee?.name;
    const statusLabel = blocker.status.replace(/_/g, " ").toLowerCase();
    return {
      blockedBy: stageName,
      blockedOwner: owner,
      blockedMessage: owner
        ? `${stageName} cannot start yet — waiting on ${owner} (${statusLabel}).`
        : `${stageName} must be completed first (currently ${statusLabel}).`,
    };
  }
  return {
    blockedBy: "Workflow dependency",
    blockedMessage: "This task is blocked by an incomplete prior stage.",
  };
}
