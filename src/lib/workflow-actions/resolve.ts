import { ROUTES } from "@/config/routes";
import { getTaskStartAvailability } from "@/lib/action-availability";
import {
  getDesignWorkflowContext,
  findNextActionableTask,
} from "@/lib/design-workflow";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { actionMeta } from "@/lib/workflow-actions/definitions";
import {
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions/types";
import type { CorrectionRecord } from "@/lib/types/api";

type ApprovalQueueItem = {
  designId: string;
  currentLevel: { id: number; name: string };
};

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
    .filter((t) => !SATISFIED.has(t.status) && t.subProcess?.code !== "CORRECTION")
    .map((t) => t.subProcess?.name ?? "Stage");
}

export function resolveDesignContextActions(input: {
  design: DesignSummary;
  employeeId?: number;
  permissions: string[];
  approvalsQueueHref?: string;
}): ResolvedWorkflowAction[] {
  const { design, employeeId, permissions } = input;
  const approvalsQueueHref = input.approvalsQueueHref ?? ROUTES.quality.approvals;
  const canApprove = permissions.includes(PERMISSIONS.DESIGN_APPROVE);
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const tasks = design.tasks ?? [];
  const context = getDesignWorkflowContext({ status: design.status, tasks });
  const actions: ResolvedWorkflowAction[] = [];

  const nextTask = findNextActionableTask(tasks, employeeId, canApprove);
  if (nextTask && (canExecute || (canApprove && nextTask.subProcess?.isApproval))) {
    if (!nextTask.subProcess?.isApproval) {
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

  const openApprovals = tasks.some(
    (t) =>
      t.subProcess?.isApproval &&
      !SATISFIED.has(t.status) &&
      t.status !== "CANCELLED",
  );

  if (canApprove && design.status === "APPROVAL_PENDING") {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.OPEN_APPROVALS_QUEUE, {
        enabled: true,
        href: approvalsQueueHref,
        designId: design.id,
      }),
    );
  } else if (canApprove && ["DRAFT", "ACTIVE"].includes(design.status)) {
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

export function resolveApprovalContextActions(input: {
  item: ApprovalQueueItem;
  permissions: string[];
}): ResolvedWorkflowAction[] {
  if (!hasPermission(input.permissions, PERMISSIONS.DESIGN_APPROVE)) {
    return [
      buildAction(WORKFLOW_ACTION_CODES.APPROVE_LEVEL, {
        enabled: false,
        disabledReason: "You do not have permission to approve designs.",
      }),
    ];
  }

  return [
    buildAction(WORKFLOW_ACTION_CODES.APPROVE_LEVEL, {
      enabled: true,
      designId: input.item.designId,
      description: `Record approval for ${input.item.currentLevel.name}.`,
    }),
    buildAction(WORKFLOW_ACTION_CODES.REJECT_LEVEL, {
      enabled: true,
      designId: input.item.designId,
      variant: "destructive",
    }),
    buildAction(WORKFLOW_ACTION_CODES.REQUEST_APPROVAL_CORRECTION, {
      enabled: true,
      designId: input.item.designId,
      variant: "warning",
      description: "Send back for correction before approval can continue.",
    }),
  ];
}

export function resolveCorrectionContextActions(input: {
  permissions: string[];
  correction?: CorrectionRecord;
}): ResolvedWorkflowAction[] {
  const canRaise = input.permissions.includes(PERMISSIONS.CORRECTION_RAISE);
  const actions: ResolvedWorkflowAction[] = [];

  actions.push(
    buildAction(WORKFLOW_ACTION_CODES.RAISE_CORRECTION, {
      enabled: canRaise,
      disabledReason: canRaise ? undefined : "You do not have permission to raise corrections.",
    }),
  );

  if (input.correction) {
    const done = input.correction.status === "DONE";
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION, {
        enabled: canRaise && !done,
        disabledReason: done ? "This correction is already marked done." : undefined,
        designId: input.correction.design.id,
      }),
    );
  }

  return actions;
}

export function resolveCostingContextActions(input: {
  designId?: string;
  hasCosting?: boolean;
  permissions: string[];
}): ResolvedWorkflowAction[] {
  const canView = input.permissions.includes(PERMISSIONS.COST_VIEW);
  const actions: ResolvedWorkflowAction[] = [];

  actions.push(
    buildAction(WORKFLOW_ACTION_CODES.ADD_COST, {
      enabled: canView && !!input.designId,
      disabledReason: !input.designId
        ? "Select a design to add cost entries."
        : !canView
          ? "You do not have permission to view costing."
          : undefined,
      designId: input.designId,
    }),
  );

  if (input.designId) {
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.VIEW_DESIGN_COSTING, {
        enabled: true,
        href: ROUTES.designs.detail(input.designId),
        designId: input.designId,
      }),
      buildAction(WORKFLOW_ACTION_CODES.REQUEST_APPROVAL, {
        enabled: !!input.hasCosting,
        disabledReason: input.hasCosting
          ? undefined
          : "Add at least one cost entry before requesting final approval.",
        designId: input.designId,
        variant: "secondary",
      }),
    );
  }

  return actions;
}

export function resolveProductionContextActions(input: {
  permissions: string[];
  canReturn?: boolean;
  instructionTaskId?: string;
  releaseTaskId?: string;
  designStatus?: string;
  designId?: string;
}): ResolvedWorkflowAction[] {
  const canProd = input.permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  if (!canProd) {
    return [
      buildAction(WORKFLOW_ACTION_CODES.OPEN_PRODUCTION_TASKS, {
        enabled: false,
        disabledReason: "You do not have production desk access.",
      }),
    ];
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
    actions.push(
      buildAction(WORKFLOW_ACTION_CODES.MARK_LIVE, {
        enabled: true,
        designId: input.designId,
        variant: "primary",
      }),
    );
  }

  return actions;
}
