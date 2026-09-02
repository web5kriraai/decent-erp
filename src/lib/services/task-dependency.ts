/** Pure task-dependency helpers — safe to import from client components. */

/** Prior-stage statuses that unlock the next dependency sequence. */
export const DEPENDENCY_SATISFIED_STATUSES = [
  "COMPLETED",
  "CHECKING",
  "CANCELLED",
  "SKIPPED",
] as const;

/** Statuses shown on My Tasks / open-task counts (never PENDING). */
export const MY_TASKS_VISIBLE_STATUSES = [
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "CORRECTION_REQUIRED",
] as const;

export type DepSeqTask = {
  id?: string | bigint | number;
  dependencySequence: number | null;
  sequence: number;
  status: string;
};

export function isDependencySatisfiedStatus(status: string): boolean {
  return (DEPENDENCY_SATISFIED_STATUSES as readonly string[]).includes(status);
}

export function effectiveDependencySequence(task: {
  dependencySequence: number | null;
  sequence: number;
}): number {
  return task.dependencySequence ?? task.sequence;
}

export function minReadyDependencySequence(
  tasks: Array<{ dependencySequence: number | null; sequence: number }>,
): number {
  if (tasks.length === 0) return 1;
  return Math.min(...tasks.map((t) => effectiveDependencySequence(t)));
}

export function initialStatusForCreate(input: {
  hasAssignee: boolean;
  isReady: boolean;
}): "PENDING" | "ASSIGNED" {
  return input.hasAssignee && input.isReady ? "ASSIGNED" : "PENDING";
}

/** Prior pipeline stages (by sequence) that can block this task from starting. */
export function isPriorPipelineStage(
  sibling: { sequence: number },
  task: { sequence: number },
): boolean {
  return sibling.sequence < task.sequence;
}

/** Ready when every earlier pipeline stage (lower sequence) is satisfied. */
export function isTaskReady(task: DepSeqTask, siblings: DepSeqTask[]): boolean {
  return siblings.every((sibling) => {
    if (task.id != null && sibling.id != null && String(task.id) === String(sibling.id)) {
      return true;
    }
    if (!isPriorPipelineStage(sibling, task)) return true;
    return isDependencySatisfiedStatus(sibling.status);
  });
}
