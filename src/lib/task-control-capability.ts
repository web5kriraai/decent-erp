import { PERMISSIONS } from "@/lib/permissions";
import { usesStageApprovalActionsNotTimerEnd } from "@/lib/stage-approval-rbac";

export type TaskControlSubProcess = {
  code: string;
  isApproval?: boolean;
  capabilities?: unknown;
  defaultRole?: { code?: string | null } | null;
};

export type TaskControlSnapshot = {
  status: string;
  assignedEmployeeId?: number | null;
  subProcess: TaskControlSubProcess;
};

/**
 * Work-task controls and the Open link. Only the employee assigned on the task,
 * with TASK_EXECUTE, may open or run it. Role ownership of a stage does not
 * open a task assigned to someone else.
 */
export function canControlTask(input: {
  permissions: string[];
  employeeId?: number | null;
  roleCode?: string | null;
  task: TaskControlSnapshot;
}): boolean {
  void input.roleCode;
  const canExecute = input.permissions.includes(PERMISSIONS.TASK_EXECUTE);
  if (!canExecute || input.employeeId == null || input.task.assignedEmployeeId == null) {
    return false;
  }
  return Number(input.task.assignedEmployeeId) === Number(input.employeeId);
}

export type TimerControlFlags = {
  isRunning: boolean;
  isOnHold: boolean;
  blocksTimerEnd: boolean;
  showStart: boolean;
  showHold: boolean;
  showResume: boolean;
  showEnd: boolean;
};

/**
 * Hold/Resume for active timers; End only when the stage is not finished via
 * stage-approval actions (Approve / Correction / Reject).
 */
export function getTimerControlFlags(
  task: {
    status: string;
    subProcess: {
      code: string;
      isApproval?: boolean;
      capabilities?: unknown;
    };
  },
  options?: { endDialogMode?: string | null },
): TimerControlFlags {
  const isRunning = task.status === "RUNNING";
  const isOnHold = task.status === "ON_HOLD";
  const showStart =
    task.status === "ASSIGNED" ||
    task.status === "CORRECTION_REQUIRED" ||
    task.status === "PENDING";
  const blocksTimerEnd =
    usesStageApprovalActionsNotTimerEnd(task.subProcess.code, {
      isApproval: task.subProcess.isApproval,
      capabilities: task.subProcess.capabilities,
    }) || options?.endDialogMode === "stage_approval";

  return {
    isRunning,
    isOnHold,
    blocksTimerEnd,
    showStart,
    showHold: isRunning,
    showResume: isOnHold,
    showEnd: !blocksTimerEnd && (isRunning || isOnHold),
  };
}

/**
 * Active RUNNING/ON_HOLD task assigned to the viewer on a design page.
 */
export function findControllableActiveTask<
  T extends {
    id: string;
    status: string;
    assignedEmployeeId?: number | null;
    subProcess: TaskControlSubProcess;
  },
>(
  tasks: T[] | undefined,
  input: {
    permissions: string[];
    employeeId?: number | null;
    roleCode?: string | null;
  },
): T | null {
  if (!tasks?.length) return null;
  return (
    tasks.find(
      (t) =>
        (t.status === "RUNNING" || t.status === "ON_HOLD") &&
        canControlTask({
          permissions: input.permissions,
          employeeId: input.employeeId,
          roleCode: input.roleCode,
          task: t,
        }),
    ) ?? null
  );
}
