import { PERMISSIONS } from "@/lib/permissions";
import {
  canRoleActOnStageApproval,
  usesStageApprovalActionsNotTimerEnd,
} from "@/lib/stage-approval-rbac";

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
 * Same gate as TaskDetailView: execute permission + assignee OR stage-approval owner.
 */
export function canControlTask(input: {
  permissions: string[];
  employeeId?: number | null;
  roleCode?: string | null;
  task: TaskControlSnapshot;
}): boolean {
  const canExecute = input.permissions.includes(PERMISSIONS.TASK_EXECUTE);
  if (!canExecute) return false;

  const isAssignee =
    input.employeeId != null && input.task.assignedEmployeeId === input.employeeId;

  const ownerRoleCode = input.task.subProcess.defaultRole?.code ?? null;
  const isStageApproval = usesStageApprovalActionsNotTimerEnd(input.task.subProcess.code, {
    isApproval: input.task.subProcess.isApproval,
    capabilities: input.task.subProcess.capabilities,
  });
  const canActOnStage =
    isStageApproval &&
    !!input.roleCode &&
    canRoleActOnStageApproval(input.roleCode, input.task.subProcess.code, {
      ownerRoleCode,
      capabilities: input.task.subProcess.capabilities,
    });

  return isAssignee || canActOnStage;
}

export type TimerControlFlags = {
  isRunning: boolean;
  isOnHold: boolean;
  blocksTimerEnd: boolean;
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
  const blocksTimerEnd =
    usesStageApprovalActionsNotTimerEnd(task.subProcess.code, {
      isApproval: task.subProcess.isApproval,
      capabilities: task.subProcess.capabilities,
    }) || options?.endDialogMode === "stage_approval";

  return {
    isRunning,
    isOnHold,
    blocksTimerEnd,
    showHold: isRunning,
    showResume: isOnHold,
    showEnd: !blocksTimerEnd && (isRunning || isOnHold),
  };
}

/**
 * Active RUNNING/ON_HOLD task the viewer may control on a design page
 * (assignee or stage-approval owner).
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
