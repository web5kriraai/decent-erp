import { isTaskReady } from "@/lib/services/task-dependency";
import {
  buildBlockedContext,
  findDependencyBlocker,
  findNextOpenTask,
} from "@/lib/services/action-center";
import {
  findStageApprovalGate,
  isWorkflowStepAssignable,
  resolveEffectiveTaskStatus,
  type StageGateSibling,
} from "@/lib/services/workflow-stage-gate";
import { PERMISSIONS } from "@/lib/permissions";
import {
  resolveDesignContextActions,
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

const SATISFIED_STATUSES = new Set(["COMPLETED", "CHECKING", "CANCELLED", "SKIPPED"]);
const ACTIONABLE_STATUSES = new Set([
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "PENDING",
]);

export { isWorkflowStepAssignable };

export type WorkflowStep = {
  task: DesignTask;
  sequence: number;
  label: string;
  code: string;
  status: string;
  isApproval: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
  isDone: boolean;
  canReassign: boolean;
  displayStatus: string;
  assigneeName?: string | null;
};

export type DesignWorkflowAction = {
  id: string;
  label: string;
  description: string;
  taskId?: string;
  href?: string;
  kind: "task" | "inline_approval" | "request_approval" | "approvals_queue";
  emphasis: "primary" | "secondary";
  stageCode?: string;
};

function sortTasks(tasks: DesignTask[] | undefined): DesignTask[] {
  return [...(tasks ?? [])].sort((a, b) => a.sequence - b.sequence);
}

function toDepSeqTasks(tasks: DesignTask[]): Array<{
  id: string;
  dependencySequence: number | null;
  sequence: number;
  status: string;
}> {
  return tasks.map((t) => ({
    id: t.id,
    dependencySequence: t.dependencySequence ?? null,
    sequence: t.sequence,
    status: t.status,
  }));
}

function toStageGateSiblings(tasks: DesignTask[]): StageGateSibling[] {
  return tasks.map((t) => ({
    id: t.id,
    dependencySequence: t.dependencySequence ?? null,
    sequence: t.sequence,
    status: t.status,
    assignedEmployeeId: t.assignedEmployeeId ?? null,
    subProcess: t.subProcess,
    assignedEmployee: t.assignedEmployee,
  }));
}

function findCurrentStepIndex(ordered: DesignTask[], siblings: StageGateSibling[]): number {
  const effective = ordered.map((t) =>
    resolveEffectiveTaskStatus(
      {
        id: t.id,
        dependencySequence: t.dependencySequence ?? null,
        sequence: t.sequence,
        status: t.status,
        subProcess: t.subProcess,
      },
      siblings,
    ),
  );

  const runningIdx = ordered.findIndex((t) => t.status === "RUNNING" || t.status === "ON_HOLD");
  if (runningIdx >= 0) return runningIdx;

  const correctionIdx = ordered.findIndex((t) => t.status === "CORRECTION_REQUIRED");
  if (correctionIdx >= 0) return correctionIdx;

  const firstOpenIdx = effective.findIndex(
    (status) => status !== "COMPLETED" && status !== "CANCELLED" && status !== "SKIPPED",
  );
  return firstOpenIdx >= 0 ? firstOpenIdx : Math.max(0, ordered.length - 1);
}

function workflowDisplayStatus(
  effectiveStatus: string,
  isCurrent: boolean,
  isUpcoming: boolean,
): string {
  if (isUpcoming) return "UPCOMING";
  if (effectiveStatus === "SKIPPED") return "SKIPPED";
  if (effectiveStatus === "COMPLETED") return "COMPLETED";
  if (isCurrent && (effectiveStatus === "RUNNING" || effectiveStatus === "ON_HOLD")) {
    return "IN_PROGRESS";
  }
  if (isCurrent && effectiveStatus === "ASSIGNED") return "IN_PROGRESS";
  return effectiveStatus;
}

export function buildWorkflowSteps(tasks: DesignTask[] | undefined): WorkflowStep[] {
  const ordered = sortTasks(tasks);
  const siblings = toStageGateSiblings(ordered);
  const currentIdx = findCurrentStepIndex(ordered, siblings);

  return ordered.map((task, index) => {
    const effectiveStatus = resolveEffectiveTaskStatus(
      {
        id: task.id,
        dependencySequence: task.dependencySequence ?? null,
        sequence: task.sequence,
        status: task.status,
        subProcess: task.subProcess,
      },
      siblings,
    );
    const isDone = effectiveStatus === "COMPLETED";
    const isSkipped = task.status === "SKIPPED";
    const isUpcoming = task.status === "PENDING" && index > currentIdx && !isSkipped;
    const isCurrent = index === currentIdx && !isDone && !isUpcoming;
    const hasLaterOpenWork = ordered.slice(index + 1).some((t) => {
      const laterEffective = resolveEffectiveTaskStatus(
        {
          id: t.id,
          dependencySequence: t.dependencySequence ?? null,
          sequence: t.sequence,
          status: t.status,
          subProcess: t.subProcess,
        },
        siblings,
      );
      return (
        t.status !== "PENDING" &&
        laterEffective !== "COMPLETED" &&
        laterEffective !== "CANCELLED"
      );
    });
    const canReassign =
      !isUpcoming &&
      !isDone &&
      isWorkflowStepAssignable(task.status) &&
      (isCurrent ||
        (index < currentIdx &&
          ["ASSIGNED", "RUNNING", "ON_HOLD"].includes(task.status) &&
          hasLaterOpenWork));

    return {
      task,
      sequence: task.sequence,
      label: task.subProcess?.name ?? "Task",
      code: task.subProcess?.code ?? "",
      status: task.status,
      isApproval: !!task.subProcess?.isApproval,
      isCurrent,
      isUpcoming,
      isDone,
      canReassign,
      displayStatus: workflowDisplayStatus(effectiveStatus, isCurrent, isUpcoming),
      assigneeName: task.assignedEmployee?.name ?? null,
    };
  });
}

export function findNextActionableTask(
  tasks: DesignTask[],
  employeeId?: number,
  canApprove = false,
): DesignTask | null {
  const siblings = toDepSeqTasks(tasks);

  for (const task of sortTasks(tasks)) {
    if (!ACTIONABLE_STATUSES.has(task.status)) continue;
    if (task.status === "COMPLETED" || task.status === "CANCELLED") continue;

    const ready = isTaskReady(
      {
        id: task.id,
        dependencySequence: task.dependencySequence ?? null,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (!ready) continue;

    const isApprovalStage = !!task.subProcess?.isApproval;
    const isMine = employeeId != null && task.assignedEmployeeId === employeeId;
    const isUnassigned = task.assignedEmployeeId == null;

    if (isApprovalStage && (isMine || isUnassigned || canApprove)) {
      if (["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"].includes(task.status)) {
        return task;
      }
    }

    if (!isApprovalStage && isMine && ["ASSIGNED", "RUNNING", "ON_HOLD"].includes(task.status)) {
      return task;
    }
  }

  return null;
}

export type PendingStageApproval = {
  approvalTask: DesignTask;
  /** Related work task (e.g. SKETCH when approving SKETCH_APPROVAL). */
  workTask?: DesignTask;
};

export function getPendingStageApproval(input: {
  design: DesignSummary;
  employeeId?: number;
  canApprove: boolean;
  canExecute: boolean;
}): PendingStageApproval | null {
  const { design, employeeId, canApprove, canExecute } = input;
  if (!(canExecute || canApprove)) return null;

  const tasks = sortTasks(design.tasks);
  const siblings = toDepSeqTasks(tasks);

  const sketch = tasks.find((t) => t.subProcess?.code === "SKETCH");
  const sketchApproval = tasks.find((t) => t.subProcess?.code === "SKETCH_APPROVAL");
  if (
    sketch?.status === "CHECKING" &&
    sketchApproval &&
    ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "PENDING"].includes(sketchApproval.status)
  ) {
    const ready = isTaskReady(
      {
        id: sketchApproval.id,
        dependencySequence: sketchApproval.dependencySequence ?? null,
        sequence: sketchApproval.sequence,
        status: sketchApproval.status,
      },
      siblings,
    );
    if (ready) {
      const isMine =
        employeeId != null && sketchApproval.assignedEmployeeId === employeeId;
      const isUnassigned = sketchApproval.assignedEmployeeId == null;
      if (isMine || isUnassigned || canApprove) {
        return { approvalTask: sketchApproval, workTask: sketch };
      }
    }
  }

  const punch = tasks.find((t) => t.subProcess?.code === "PUNCH");
  const punchCheck = tasks.find((t) => t.subProcess?.code === "PUNCH_CHECK");
  if (
    punch?.status === "CHECKING" &&
    punchCheck &&
    ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "PENDING"].includes(punchCheck.status)
  ) {
    const ready = isTaskReady(
      {
        id: punchCheck.id,
        dependencySequence: punchCheck.dependencySequence ?? null,
        sequence: punchCheck.sequence,
        status: punchCheck.status,
      },
      siblings,
    );
    if (ready) {
      const isMine = employeeId != null && punchCheck.assignedEmployeeId === employeeId;
      const isUnassigned = punchCheck.assignedEmployeeId == null;
      if (isMine || isUnassigned || canApprove) {
        return { approvalTask: punchCheck, workTask: punch };
      }
    }
  }

  const machineSample = tasks.find((t) => t.subProcess?.code === "MACHINE_SAMPLE");
  const sampleCheck = tasks.find((t) => t.subProcess?.code === "SAMPLE_CHECK");
  if (
    machineSample?.status === "CHECKING" &&
    sampleCheck &&
    ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "PENDING"].includes(sampleCheck.status)
  ) {
    const ready = isTaskReady(
      {
        id: sampleCheck.id,
        dependencySequence: sampleCheck.dependencySequence ?? null,
        sequence: sampleCheck.sequence,
        status: sampleCheck.status,
      },
      siblings,
    );
    if (ready) {
      const isMine = employeeId != null && sampleCheck.assignedEmployeeId === employeeId;
      const isUnassigned = sampleCheck.assignedEmployeeId == null;
      if (isMine || isUnassigned || canApprove) {
        return { approvalTask: sampleCheck, workTask: machineSample };
      }
    }
  }

  const costing = tasks.find((t) => t.subProcess?.code === "COSTING");
  const finalApproval = tasks.find((t) => t.subProcess?.code === "FINAL_APPROVAL");
  if (
    costing &&
    ["CHECKING", "COMPLETED"].includes(costing.status) &&
    finalApproval &&
    ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "PENDING"].includes(finalApproval.status)
  ) {
    const ready = isTaskReady(
      {
        id: finalApproval.id,
        dependencySequence: finalApproval.dependencySequence ?? null,
        sequence: finalApproval.sequence,
        status: finalApproval.status,
      },
      siblings,
    );
    if (ready) {
      const isMine = employeeId != null && finalApproval.assignedEmployeeId === employeeId;
      const isUnassigned = finalApproval.assignedEmployeeId == null;
      if (isMine || isUnassigned || canApprove) {
        return {
          approvalTask: finalApproval,
          workTask: costing.status === "CHECKING" ? costing : undefined,
        };
      }
    }
  }

  for (const task of tasks) {
    if (!task.subProcess?.isApproval) continue;
    if (!["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"].includes(task.status)) continue;

    const ready = isTaskReady(
      {
        id: task.id,
        dependencySequence: task.dependencySequence ?? null,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (!ready) continue;

    const isMine = employeeId != null && task.assignedEmployeeId === employeeId;
    const isUnassigned = task.assignedEmployeeId == null;
    if (!(isMine || isUnassigned || canApprove)) continue;

    const code = task.subProcess.code;
    const workTask =
      code === "SKETCH_APPROVAL"
        ? tasks.find((t) => t.subProcess?.code === "SKETCH")
        : code === "PUNCH_CHECK"
          ? tasks.find((t) => t.subProcess?.code === "PUNCH" && t.status === "CHECKING")
          : code === "SAMPLE_CHECK"
            ? tasks.find(
                (t) => t.subProcess?.code === "MACHINE_SAMPLE" && t.status === "CHECKING",
              )
            : code === "FINAL_APPROVAL"
              ? tasks.find((t) => t.subProcess?.code === "COSTING" && t.status === "CHECKING")
              : undefined;

    return { approvalTask: task, workTask };
  }

  return null;
}

function mapResolvedToLegacyAction(
  action: ResolvedWorkflowAction,
  emphasis: "primary" | "secondary",
): DesignWorkflowAction {
  if (action.code === WORKFLOW_ACTION_CODES.OPEN_APPROVALS_QUEUE && action.href) {
    return {
      id: "approvals-queue",
      kind: "approvals_queue",
      href: action.href,
      label: action.label,
      description: action.description ?? "",
      emphasis,
    };
  }
  if (action.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL) {
    return {
      id: "request-approval",
      kind: "request_approval",
      label: action.label,
      description: action.description ?? "",
      emphasis,
    };
  }
  return {
    id: action.taskId ? `task-${action.taskId}` : action.code,
    kind: "task",
    taskId: action.taskId,
    label: action.label,
    description: action.description ?? "",
    emphasis,
  };
}

export function getDesignContextActions(input: {
  design: DesignSummary;
  employeeId?: number;
  canApprove: boolean;
  canExecute: boolean;
  canAssign?: boolean;
  approvalsQueueHref: string;
}): ResolvedWorkflowAction[] {
  const permissions: string[] = [];
  if (input.canApprove) permissions.push(PERMISSIONS.DESIGN_APPROVE);
  if (input.canExecute) permissions.push(PERMISSIONS.TASK_EXECUTE);
  if (input.canAssign) permissions.push(PERMISSIONS.DESIGN_ASSIGN);
  return resolveDesignContextActions({
    design: input.design,
    employeeId: input.employeeId,
    permissions,
    approvalsQueueHref: input.approvalsQueueHref,
  });
}

export function getDesignWorkflowActions(input: {
  design: DesignSummary;
  employeeId?: number;
  canApprove: boolean;
  canExecute: boolean;
  approvalsQueueHref: string;
}): DesignWorkflowAction[] {
  const resolved = getDesignContextActions(input);
  return resolved
    .filter((action) => action.enabled)
    .map((action, index) => mapResolvedToLegacyAction(action, index === 0 ? "primary" : "secondary"));
}

export function getWorkflowStatusMessage(
  steps: WorkflowStep[],
  designStatus: string,
): string | null {
  return getDesignWorkflowContext({ status: designStatus, tasks: steps.map((s) => s.task) }).summary;
}

export type DesignWorkflowContext = {
  summary: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  currentOwner: string | null;
  nextAction: string | null;
  nextOwner: string | null;
  blockingLabel: string | null;
  blockingOwner: string | null;
  waitingMessage: string | null;
  nextActionHint: string | null;
};

export function getDesignWorkflowContext(input: {
  status: string;
  tasks?: DesignTask[];
}): DesignWorkflowContext {
  const tasks = sortTasks(input.tasks);
  const steps = buildWorkflowSteps(tasks);
  const siblings = toStageGateSiblings(tasks);

  const waitingForApproval = tasks.find((task) => {
    if (task.status !== "CHECKING" || task.subProcess?.isApproval) return false;
    const gate = findStageApprovalGate(
      {
        id: task.id,
        dependencySequence: task.dependencySequence ?? null,
        sequence: task.sequence,
        subProcess: task.subProcess,
      },
      siblings,
    );
    return gate != null && ["ASSIGNED", "PENDING", "RUNNING", "ON_HOLD"].includes(gate.status);
  });

  if (waitingForApproval) {
    const workStep = steps.find((s) => s.task.id === waitingForApproval.id);
    const gate = findStageApprovalGate(
      {
        id: waitingForApproval.id,
        dependencySequence: waitingForApproval.dependencySequence ?? null,
        sequence: waitingForApproval.sequence,
        subProcess: waitingForApproval.subProcess,
      },
      siblings,
    );
    return {
      summary: `${workStep?.label ?? "Work"} submitted — waiting for review.`,
      currentStage: workStep?.label ?? null,
      currentStatus: "checking",
      currentOwner: workStep?.assigneeName ?? null,
      nextAction: gate?.subProcess?.name ?? "Stage approval",
      nextOwner: gate?.assignedEmployee?.name ?? null,
      blockingLabel: null,
      blockingOwner: null,
      waitingMessage: `Waiting for ${gate?.assignedEmployee?.name ?? "approver"}: ${gate?.subProcess?.name ?? "stage approval"}.`,
      nextActionHint: null,
    };
  }

  const empty: DesignWorkflowContext = {
    summary: null,
    currentStage: null,
    currentStatus: null,
    currentOwner: null,
    nextAction: null,
    nextOwner: null,
    blockingLabel: null,
    blockingOwner: null,
    waitingMessage: null,
    nextActionHint: null,
  };

  if (input.status === "APPROVAL_PENDING") {
    return {
      ...empty,
      summary: "This design is in the final approval queue.",
      currentStage: "Final approval chain",
      currentStatus: "approval pending",
      nextAction: "Management / approver decision",
      waitingMessage: "Waiting for the next approver in the approval chain.",
    };
  }

  if (input.status === "APPROVED") {
    const handoff = tasks.find((t) => t.subProcess?.code === "PROD_HANDOFF");
    const instruction = tasks.find((t) => t.subProcess?.code === "PROD_INSTRUCTION");
    if (handoff && handoff.status !== "COMPLETED") {
      return {
        ...empty,
        summary: "Approved — Design Head must complete production handoff.",
        currentStage: handoff.subProcess?.name ?? "Production Handoff",
        currentStatus: handoff.status.replace(/_/g, " ").toLowerCase(),
        currentOwner: handoff.assignedEmployee?.name ?? "Design Head",
        nextAction: "Send to production",
        nextOwner: handoff.assignedEmployee?.name ?? "Design Head",
      };
    }
    if (instruction && instruction.status !== "COMPLETED") {
      return {
        ...empty,
        summary: "Production Head must complete instruction and release on My Tasks.",
        currentStage: instruction.subProcess?.name ?? "Production Instruction",
        currentStatus: instruction.status.replace(/_/g, " ").toLowerCase(),
        currentOwner: instruction.assignedEmployee?.name ?? "Production Head",
        nextAction: "Production instruction → release",
        nextOwner: instruction.assignedEmployee?.name ?? "Production Head",
      };
    }
    return {
      ...empty,
      summary: "Approved and ready for production workflow completion.",
      currentStage: "Production",
      currentStatus: "approved",
    };
  }

  if (input.status === "PRODUCTION_RELEASED") {
    return {
      ...empty,
      summary: "Released to production. ERP handoff modules are processing.",
      currentStage: "Production released",
      currentStatus: "production released",
    };
  }

  const currentStep = steps.find((s) => s.isCurrent);
  const firstOpen = tasks.find((t) => {
    const effective = resolveEffectiveTaskStatus(
      {
        id: t.id,
        dependencySequence: t.dependencySequence ?? null,
        sequence: t.sequence,
        status: t.status,
        subProcess: t.subProcess,
      },
      siblings,
    );
    return effective !== "COMPLETED" && effective !== "CANCELLED";
  });

  if (!firstOpen) {
    return {
      ...empty,
      summary: "All workflow stages are complete for this design.",
      currentStage: currentStep?.label ?? null,
      currentStatus: currentStep?.status.replace(/_/g, " ").toLowerCase() ?? null,
    };
  }

  const openRow = {
    id: firstOpen.id,
    status: firstOpen.status,
    dependencySequence: firstOpen.dependencySequence ?? null,
    sequence: firstOpen.sequence,
    subProcess: firstOpen.subProcess,
    assignedEmployeeId: firstOpen.assignedEmployeeId ?? null,
  };

  const ready = isTaskReady(
    {
      id: firstOpen.id,
      dependencySequence: firstOpen.dependencySequence ?? null,
      sequence: firstOpen.sequence,
      status: firstOpen.status,
    },
    siblings,
  );

  if (!ready) {
    const blocker = findDependencyBlocker(openRow, siblings);
    const blocked = buildBlockedContext(openRow, siblings);
    return {
      summary: `${firstOpen.subProcess?.name ?? "This stage"} cannot start yet.`,
      currentStage: firstOpen.subProcess?.name ?? null,
      currentStatus: firstOpen.status.replace(/_/g, " ").toLowerCase(),
      currentOwner: firstOpen.assignedEmployee?.name ?? null,
      nextAction: blocker?.subProcess?.name ?? blocked.blockedBy,
      nextOwner: blocked.blockedOwner ?? blocker?.assignedEmployee?.name ?? null,
      blockingLabel: blocked.blockedBy,
      blockingOwner: blocked.blockedOwner ?? null,
      waitingMessage: `Blocked by ${blocked.blockedBy}${blocked.blockedOwner ? ` (${blocked.blockedOwner})` : ""}.`,
      nextActionHint: null,
    };
  }

  const nextAfterCurrent = findNextOpenTask(siblings, firstOpen.sequence);
  const sampleCheck = tasks.find((t) => t.subProcess?.code === "SAMPLE_CHECK");
  let nextActionHint: string | null = null;
  if (sampleCheck && ["RUNNING", "ASSIGNED", "ON_HOLD"].includes(sampleCheck.status)) {
    nextActionHint =
      "Review sample and provide decision: Approve / Request Re-sample / Raise Correction";
  } else if (firstOpen.subProcess?.code === "SAMPLE_CHECK") {
    nextActionHint =
      "Review sample and provide decision: Approve / Request Re-sample / Raise Correction";
  }

  return {
    summary: currentStep
      ? `Current stage: ${currentStep.label} (${currentStep.displayStatus.replace(/_/g, " ").toLowerCase()}).`
      : null,
    currentStage: firstOpen.subProcess?.name ?? currentStep?.label ?? null,
    currentStatus: (currentStep?.displayStatus ?? firstOpen.status).replace(/_/g, " ").toLowerCase(),
    currentOwner: firstOpen.assignedEmployee?.name ?? null,
    nextAction: nextAfterCurrent?.subProcess?.name ?? null,
    nextOwner: nextAfterCurrent?.assignedEmployee?.name ?? null,
    blockingLabel: null,
    blockingOwner: null,
    waitingMessage: null,
    nextActionHint,
  };
}
