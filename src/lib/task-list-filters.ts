const DONE_TASK = new Set(["COMPLETED", "CANCELLED"]);

/** Mirrors Action Center buckets used for dashboard open-task counts. */
export function isDashboardOpenTask(task: {
  status: string;
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
}): boolean {
  if (DONE_TASK.has(task.status)) return false;
  if (task.effectiveStatus === "COMPLETED") return false;
  if (task.isWaitingOnOthers) return false;
  if (task.status === "PENDING") return false;
  if (task.status === "CHECKING") return false;
  return true;
}

export function countDashboardOpenTasks(
  tasks: Array<{
    status: string;
    effectiveStatus?: string;
    isWaitingOnOthers?: boolean;
  }>,
): number {
  return tasks.filter(isDashboardOpenTask).length;
}
