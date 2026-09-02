import {
  effectiveDependencySequence,
  isDependencySatisfiedStatus,
} from "@/lib/services/task-dependency";

/** Statuses where a manager may (re)assign an employee. */
export const WORKFLOW_ASSIGNABLE_STATUSES = new Set(["PENDING", "ASSIGNED"]);

export type StageGateTask = {
  id: string;
  dependencySequence: number | null;
  sequence: number;
  subProcess?: { isApproval?: boolean } | null;
};

export type StageGateSibling = {
  id: string;
  dependencySequence: number | null;
  sequence: number;
  status: string;
  assignedEmployeeId?: number | null;
  subProcess?: { name: string; code: string; isApproval?: boolean } | null;
  assignedEmployee?: { name: string } | null;
};

export function isWorkflowStepAssignable(status: string): boolean {
  return WORKFLOW_ASSIGNABLE_STATUSES.has(status);
}

/**
 * Nearest approval stage that gates this work task — e.g. SKETCH → SKETCH_APPROVAL.
 * Skips approvals separated by other open work stages (PUNCH does not wait on SAMPLE_CHECK).
 */
export function findStageApprovalGate(
  workTask: StageGateTask,
  siblings: StageGateSibling[],
): StageGateSibling | null {
  const workSeq = effectiveDependencySequence(workTask);

  const approvalsAfter = siblings
    .filter(
      (s) =>
        s.subProcess?.isApproval &&
        effectiveDependencySequence(s) > workSeq &&
        !isDependencySatisfiedStatus(s.status) &&
        s.status !== "COMPLETED",
    )
    .sort((a, b) => effectiveDependencySequence(a) - effectiveDependencySequence(b));

  for (const approval of approvalsAfter) {
    const approvalSeq = effectiveDependencySequence(approval);
    const openWorkBetween = siblings.some(
      (s) =>
        !s.subProcess?.isApproval &&
        String(s.id) !== String(workTask.id) &&
        effectiveDependencySequence(s) > workSeq &&
        effectiveDependencySequence(s) < approvalSeq &&
        !isDependencySatisfiedStatus(s.status),
    );
    if (!openWorkBetween) return approval;
  }

  return null;
}

/**
 * When a stage-approval gate exists, work must end as CHECKING (even if the client
 * requested COMPLETED). Without a gate, end as COMPLETED (even if CHECKING was requested).
 */
export function resolveWorkTaskEndStatus(
  workTask: StageGateTask,
  siblings: StageGateSibling[],
  requested: "COMPLETED" | "CHECKING",
): "COMPLETED" | "CHECKING" {
  if (workTask.subProcess?.isApproval) {
    return requested === "CHECKING" ? "CHECKING" : "COMPLETED";
  }
  if (findStageApprovalGate(workTask, siblings)) return "CHECKING";
  return "COMPLETED";
}

/** Work tasks in CHECKING whose approval gate is this completed approval stage. */
export function findCheckingWorkTasksReleasedByApproval(
  approvalTask: StageGateTask,
  siblings: StageGateSibling[],
): StageGateSibling[] {
  const approvalSeq = effectiveDependencySequence(approvalTask);

  return siblings.filter((work) => {
    if (work.subProcess?.isApproval || work.status !== "CHECKING") return false;

    const workSeq = effectiveDependencySequence(work);
    if (workSeq >= approvalSeq) return false;

    const openWorkBetween = siblings.some(
      (s) =>
        !s.subProcess?.isApproval &&
        String(s.id) !== String(work.id) &&
        effectiveDependencySequence(s) > workSeq &&
        effectiveDependencySequence(s) < approvalSeq &&
        !isDependencySatisfiedStatus(s.status),
    );
    if (openWorkBetween) return false;

    const nextApproval = siblings
      .filter((s) => s.subProcess?.isApproval && effectiveDependencySequence(s) > workSeq)
      .sort((a, b) => effectiveDependencySequence(a) - effectiveDependencySequence(b))[0];

    return nextApproval != null && String(nextApproval.id) === String(approvalTask.id);
  });
}

/**
 * Display / workflow status: CHECKING work with a satisfied approval gate reads as COMPLETED.
 */
export function resolveEffectiveTaskStatus(
  task: StageGateTask & { status: string; subProcess?: { isApproval?: boolean } | null },
  siblings: StageGateSibling[],
): string {
  if (task.status === "CHECKING" && !task.subProcess?.isApproval) {
    if (!findStageApprovalGate(task, siblings)) return "COMPLETED";
  }
  return task.status;
}
