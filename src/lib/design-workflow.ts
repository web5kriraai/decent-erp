import { isTaskReady } from "@/lib/services/task-dependency";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

const SATISFIED_STATUSES = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);
const ACTIONABLE_STATUSES = new Set([
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "PENDING",
]);

export type WorkflowStep = {
  task: DesignTask;
  sequence: number;
  label: string;
  code: string;
  status: string;
  isApproval: boolean;
  isCurrent: boolean;
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

export function buildWorkflowSteps(tasks: DesignTask[] | undefined): WorkflowStep[] {
  const ordered = sortTasks(tasks);
  const firstOpenIdx = ordered.findIndex((t) => !SATISFIED_STATUSES.has(t.status));

  return ordered.map((task, index) => ({
    task,
    sequence: task.sequence,
    label: task.subProcess?.name ?? "Task",
    code: task.subProcess?.code ?? "",
    status: task.status,
    isApproval: !!task.subProcess?.isApproval,
    isCurrent:
      firstOpenIdx === -1
        ? index === ordered.length - 1
        : index === firstOpenIdx ||
          (SATISFIED_STATUSES.has(task.status) && index === firstOpenIdx - 1),
    assigneeName: task.assignedEmployee?.name ?? null,
  }));
}

function findNextActionableTask(
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
    ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"].includes(sketchApproval.status)
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
      return { approvalTask: sketchApproval, workTask: sketch };
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
        : undefined;

    return { approvalTask: task, workTask };
  }

  return null;
}

export function getDesignWorkflowActions(input: {
  design: DesignSummary;
  employeeId?: number;
  canApprove: boolean;
  canExecute: boolean;
  approvalsQueueHref: string;
}): DesignWorkflowAction[] {
  const { design, employeeId, canApprove, canExecute, approvalsQueueHref } = input;
  const tasks = sortTasks(design.tasks);
  const actions: DesignWorkflowAction[] = [];

  const nextTask = findNextActionableTask(tasks, employeeId, canApprove);

  if (nextTask && (canExecute || (canApprove && !!nextTask.subProcess?.isApproval))) {
    if (!nextTask.subProcess?.isApproval) {
      actions.push({
        id: `task-${nextTask.id}`,
        kind: "task",
        taskId: nextTask.id,
        label: `Open ${nextTask.subProcess?.name ?? "Task"}`,
        description: `Continue ${nextTask.subProcess?.name ?? "the current task"} for this design.`,
        emphasis: "primary",
      });
    }
  }

  if (canApprove && design.status === "APPROVAL_PENDING") {
    actions.push({
      id: "approvals-queue",
      kind: "approvals_queue",
      href: approvalsQueueHref,
      label: "Open Approvals Queue",
      description: "This design is in the approval queue. Review and record your decision.",
      emphasis: actions.length === 0 ? "primary" : "secondary",
    });
  } else if (canApprove && ["DRAFT", "ACTIVE"].includes(design.status) && !nextTask) {
    actions.push({
      id: "request-approval",
      kind: "request_approval",
      label: "Request Final Approval",
      description:
        "Send the full design into the approval chain after all stage work is complete.",
      emphasis: actions.length === 0 ? "primary" : "secondary",
    });
  }

  return actions;
}

export function getWorkflowStatusMessage(
  steps: WorkflowStep[],
  designStatus: string,
): string | null {
  const sketchStep = steps.find((s) => s.code === "SKETCH");
  const sketchApproval = steps.find((s) => s.code === "SKETCH_APPROVAL");

  if (sketchStep?.status === "CHECKING" && sketchApproval?.status === "ASSIGNED") {
    return "Sketch work is submitted for checking. Design Head can start Sketch Approval.";
  }
  if (sketchStep?.status === "CHECKING" && sketchApproval?.status === "PENDING") {
    return "Sketch work is submitted for checking. Sketch Approval will unlock momentarily.";
  }
  if (designStatus === "APPROVAL_PENDING") {
    return "This design is waiting in the final approval queue.";
  }
  const current = steps.find((s) => s.isCurrent);
  if (current) {
    return `Current stage: ${current.label} (${current.status.replace(/_/g, " ").toLowerCase()}).`;
  }
  return null;
}
