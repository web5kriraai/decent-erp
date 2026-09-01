export const CLOSED_DESIGN_STATUSES = new Set(["LIVE", "CLOSED", "REJECTED"]);

export const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "SKIPPED", "CANCELLED"]);

export type SubProcessRef = {
  code: string;
  isApproval?: boolean;
};

export function isTerminalTaskStatus(status: string): boolean {
  return TERMINAL_TASK_STATUSES.has(status);
}

export function isOpenTaskStatus(status: string): boolean {
  return !isTerminalTaskStatus(status);
}

export function isDesignClosedForOverride(status: string): boolean {
  return CLOSED_DESIGN_STATUSES.has(status);
}

/** QC / check / approval stages eligible for send-to-QC override. */
export function isQcCheckTask(subProcess: SubProcessRef): boolean {
  if (subProcess.isApproval) return true;
  const code = subProcess.code;
  return /_CHECK$|_APPROVAL$|_REVIEW$/.test(code);
}

export function isDesignWorkflowComplete(
  tasks: Array<{ status: string }>,
): boolean {
  if (tasks.length === 0) return false;
  return tasks.every((t) => isTerminalTaskStatus(t.status));
}

export function countTerminalPhases(tasks: Array<{ status: string }>): {
  completed: number;
  skipped: number;
  cancelled: number;
  total: number;
} {
  return {
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    skipped: tasks.filter((t) => t.status === "SKIPPED").length,
    cancelled: tasks.filter((t) => t.status === "CANCELLED").length,
    total: tasks.length,
  };
}
