import { ROUTES } from "@/config/routes";
import { getTaskStartAvailability, canRoleMarkDesignLive } from "@/lib/action-availability";
import {
  getDesignWorkflowContext,
  findNextActionableTask,
} from "@/lib/design-workflow";
import { canRoleSeeReadyForSignOff } from "@/lib/approval-hub-rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isSignOffScopeExcluded } from "@/lib/services/approval-queue-utils";
import {
  canRoleAccessApprovalsHub,
  canRoleActOnStageApproval,
} from "@/lib/stage-approval-rbac";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { actionMeta } from "@/lib/workflow-actions/definitions";
import {
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions/types";
import type { CorrectionRecord } from "@/lib/types/api";

const SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

function buildAction(
  code: ResolvedWorkflowAction["code"],
  overrides: Partial<ResolvedWorkflowAction> & { enabled: boolean },
): ResolvedWorkflowAction {
  const meta = actionMeta(code);
  return {
    code,
    label: overrides.label ?? meta.label,
    description: overrides.description ?? meta.description,
    variant: overrides.variant ?? meta.variant,
    enabled: overrides.enabled,
    disabledReason: overrides.disabledReason,
    href: overrides.href,
    taskId: overrides.taskId,
    designId: overrides.designId,
  };
}

function incompleteStageLabels(tasks: DesignTask[] | undefined): string[] {
  return (tasks ?? [])
    .filter(
      (t) =>
        !SATISFIED.has(t.status) &&
        !isSignOffScopeExcluded(t.subProcess?.code),
    )
    .map((t) => t.subProcess?.name ?? "Stage");
}

export function resolveDesignContextActions(input: {
  design: DesignSummary;
  employeeId?: number;
  permissions: string[];
  roleCode?: string;
  approvalsQueueHref?: string;
}): ResolvedWorkflowAction[] {
  const { design, employeeId, permissions, roleCode } = input;
  const approvalsQueueHref = input.approvalsQueueHref ?? ROUTES.quality.approvals;
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const canRequestApproval = canRoleSeeReadyForSignOff(roleCode);
  const canOpenApprovalsHub = canRoleAccessApprovalsHub(roleCode);
  const tasks = design.tasks ?? [];
  const context = getDesignWorkflowContext({ status: design.status, tasks });
  const actions: ResolvedWorkflowAction[] = [];

  const nextTask = findNextActionableTask(tasks, employeeId, roleCode);
  if (nextTask && canExecute) {
    const isApproval = !!nextTask.subProcess?.isApproval;
    const approvalCode = nextTask.subProcess?.code ?? "";
    const canActOnApproval =
      !isApproval || canRoleActOnStageApproval(roleCode, approvalCode);
    if (!isApproval || canActOnApproval) {
      if (!isApproval) {
        actions.push(
          buildAction(WORKFLOW_ACTION_CODES.OPEN_TASK, {
            enabled: true,
            label: `Open ${nextTask.subProcess?.name ?? "Task"}`,
            description: `Continue ${nextTask.subProcess?.name ?? "the current task"} for this design.`,
            taskId: nextTask.id,
            designId: design.id,
            href: ROUTES.work.taskDetail(nextTask.id),
          }),
        );
      }
    }
  }

  const openApprovals = tasks.some(
    (t) =>
      t.subProcess?.isApproval &&
      !SATISFIED.has(t.status) &&
      t.status !== "CANCELLED",
  );

  if (canOpenApprovalsHub && design.status === "APPROVAL_PENDING") {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.OPEN_APPROVALS_QUEUE, {
        enabled: true,
        href: `${approvalsQueueHref}?tab=management`,
        label: "Open Management Sign-off",
        description: "Review and submit your management approval decision.",
        designId: design.id,
      }),
    );
  } else if (canRequestApproval && ["DRAFT", "ACTIVE"].includes(design.status)) {
    const incomplete = incompleteStageLabels(tasks);
    const readyForRequest = incomplete.length === 0 && !openApprovals;
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.REQUEST_APPROVAL, {
        enabled: readyForRequest,
        disabledReason:
          openApprovals
            ? "Complete open stage approvals before requesting final approval."
            : incomplete.length > 0
              ? `Complete: ${incomplete.slice(0, 4).join(", ")}${incomplete.length > 4 ? "…" : ""}`
              : undefined,
        designId: design.id,
      }),
    );
  }

  if (context.blockingLabel) {
    const blocked = buildAction(WORKFLOW_ACTION_CODES.OPEN_TASK, {
      enabled: false,
      label: "Continue workflow",
      disabledReason: `${context.blockingLabel} must be completed first${
        context.blockingOwner ? ` (${context.blockingOwner})` : ""
      }.`,
      designId: design.id,
    });
    if (!actions.some((a) => a.code === WORKFLOW_ACTION_CODES.OPEN_TASK && a.enabled)) {
      actions.push(blocked);
    }
  }

  if (canAssign && nextTask && ["PENDING", "ASSIGNED"].includes(nextTask.status)) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.ASSIGN_TASK, {
        enabled: true,
        taskId: nextTask.id,
        designId: design.id,
        variant: "outline",
      }),
    );
  }

  return actions;
}

export function resolveTaskContextActions(input: {
  task: {
    id: string;
    designId: string;
    status: string;
    sequence: number;
    dependencySequence: number | null;
    assignedEmployeeId?: number | null;
    subProcess?: { name: string; code: string; isApproval?: boolean };
    workflowPeers?: Array<{
      id: string;
      sequence: number;
      dependencySequence: number | null;
      status: string;
      assignedEmployeeId: number | null;
      subProcess: { name: string; code: string; isApproval?: boolean };
      assignedEmployee?: { name: string } | null;
    }>;
    assigneeHasRunningTask?: boolean;
  };
  isAssignee: boolean;
  permissions: string[];
}): ResolvedWorkflowAction[] {
  if (!input.isAssignee || !input.permissions.includes(PERMISSIONS.TASK_EXECUTE)) {
    return [];
  }

  const peers = input.task.workflowPeers ?? [];
  const actions: ResolvedWorkflowAction[] = [];
  const { task } = input;

  if (task.status === "ASSIGNED" || task.status === "PENDING") {
    const availability = getTaskStartAvailability(
      {
        id: task.id,
        status: task.status,
        sequence: task.sequence,
        dependencySequence: task.dependencySequence,
        assignedEmployeeId: task.assignedEmployeeId ?? null,
      },
      peers,
      { hasRunningTask: input.task.assigneeHasRunningTask },
    );
    const startLabel = task.subProcess?.name
      ? `Start ${task.subProcess.name}`
      : actionMeta(WORKFLOW_ACTION_CODES.START_TASK).label;
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.START_TASK, {
        enabled: availability.available,
        disabledReason: availability.reason,
        label: startLabel,
        taskId: task.id,
        designId: task.designId,
      }),
    );
  }

  if (task.status === "RUNNING") {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.HOLD_TASK, { enabled: true, taskId: task.id }),
      buildAction(WORKFLOW_ACTION_CODES.END_TASK, { enabled: true, taskId: task.id }),
    );
  }

  if (task.status === "ON_HOLD") {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.RESUME_TASK, { enabled: true, taskId: task.id }),
      buildAction(WORKFLOW_ACTION_CODES.END_TASK, { enabled: true, taskId: task.id }),
    );
  }

  return actions;
}

export function resolveCorrectionContextActions(input: {
  permissions: string[];
  correction?: CorrectionRecord;
  /** When false, omit raise (e.g. row-level panel). Default true. */
  includeRaise?: boolean;
}): ResolvedWorkflowAction[] {
  const canRaise = input.permissions.includes(PERMISSIONS.CORRECTION_RAISE);
  const actions: ResolvedWorkflowAction[] = [];
  const includeRaise = input.includeRaise !== false;

  // Unauthorized actions are omitted entirely (prompt: do not render).
  if (includeRaise && canRaise) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.RAISE_CORRECTION, {
        enabled: true,
      }),
    );
  }

  if (input.correction && canRaise) {
    const status = input.correction.status;
    const done = status === "DONE" || status === "REJECTED";
    if (!done) {
      actions.push(
        buildAction(WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION, {
          enabled: true,
          designId: input.correction.design.id,
        }),
      );
    }
  }

  return actions;
}

export function resolveApprovalContextActions(input: {
  permissions: string[];
  roleCode?: string | null;
  /** Pending management / stage approval item context */
  approval?: {
    designId: string;
    status?: string;
    costingReady?: boolean;
    levelName?: string;
  };
  canAccessHub?: boolean;
}): ResolvedWorkflowAction[] {
  const canApprove = input.permissions.includes(PERMISSIONS.DESIGN_APPROVE);
  const canAccessHub = input.canAccessHub ?? canRoleAccessApprovalsHub(input.roleCode);
  if (!canAccessHub && !canApprove) {
    return [];
  }

  const actions: ResolvedWorkflowAction[] = [];

  if (canAccessHub) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.OPEN_APPROVALS_QUEUE, {
        enabled: true,
        href: ROUTES.quality.approvals,
      }),
    );
  }

  if (!input.approval || !canApprove) {
    return actions;
  }

  const costingBlocksApprove = input.approval.costingReady === false;

  actions.push(
    buildAction(WORKFLOW_ACTION_CODES.APPROVE_LEVEL, {
      enabled: !costingBlocksApprove,
      disabledReason: costingBlocksApprove
        ? "Add at least one cost entry before final management approval."
        : undefined,
      designId: input.approval.designId,
    }),
    buildAction(WORKFLOW_ACTION_CODES.REJECT_LEVEL, {
      enabled: true,
      designId: input.approval.designId,
    }),
    buildAction(WORKFLOW_ACTION_CODES.REQUEST_APPROVAL_CORRECTION, {
      enabled: true,
      designId: input.approval.designId,
    }),
  );

  return actions;
}

export function resolveCostingContextActions(input: {
  designId?: string;
  hasCosting?: boolean;
  permissions: string[];
}): ResolvedWorkflowAction[] {
  const canView = input.permissions.includes(PERMISSIONS.COST_VIEW);
  if (!canView) {
    return [];
  }

  const actions: ResolvedWorkflowAction[] = [];

  if (input.designId) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.ADD_COST, {
        enabled: true,
        designId: input.designId,
      }),
      buildAction(WORKFLOW_ACTION_CODES.VIEW_DESIGN_COSTING, {
        enabled: true,
        href: ROUTES.designs.detail(input.designId),
        designId: input.designId,
      }),
    );
  } else {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.ADD_COST, {
        enabled: false,
        disabledReason: "Select a design to add cost entries.",
      }),
    );
  }

  return actions;
}

export function resolveProductionContextActions(input: {
  permissions: string[];
  roleCode?: string | null;
  canReturn?: boolean;
  instructionTaskId?: string;
  releaseTaskId?: string;
  designStatus?: string;
  designId?: string;
}): ResolvedWorkflowAction[] {
  const canProd = input.permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  if (!canProd) {
    return [];
  }

  const actions: ResolvedWorkflowAction[] = [
    buildAction(WORKFLOW_ACTION_CODES.OPEN_PRODUCTION_TASKS, {
      enabled: true,
      href: ROUTES.work.tasks,
    }),
  ];

  if (input.instructionTaskId) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.OPEN_TASK, {
        enabled: true,
        label: "Open Production Instruction",
        taskId: input.instructionTaskId,
        designId: input.designId,
        href: ROUTES.work.taskDetail(input.instructionTaskId),
        variant: "primary",
      }),
    );
  }

  if (input.releaseTaskId) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.RELEASE_PRODUCTION, {
        enabled: true,
        label: "Open Production Release",
        taskId: input.releaseTaskId,
        designId: input.designId,
        href: ROUTES.work.taskDetail(input.releaseTaskId),
        variant: "primary",
      }),
    );
  }

  if (input.designId) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.RETURN_PRODUCTION_HANDOFF, {
        enabled: !!input.canReturn,
        disabledReason: input.canReturn
          ? undefined
          : "Return is only available after Design Head handoff and before release completes.",
        designId: input.designId,
        variant: "destructive",
      }),
    );
  }

  if (input.designStatus === "PRODUCTION_RELEASED") {
    const canMarkLive = canRoleMarkDesignLive(input.roleCode);
    // Hide Mark Live entirely when role cannot perform it.
    if (canMarkLive) {
      actions.push(
        buildAction(WORKFLOW_ACTION_CODES.MARK_LIVE, {
          enabled: true,
          designId: input.designId,
          variant: "primary",
        }),
      );
    }
  }

  return actions;
}

