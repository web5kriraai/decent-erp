"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import {
  buildWorkflowSteps,
  getDesignWorkflowActions,
  getWorkflowStatusMessage,
  type DesignWorkflowAction,
} from "@/lib/design-workflow";
import type { DesignSummary } from "@/lib/types/api";
import { useAssignTask } from "@/hooks/use-tasks";
import { useRequestDesignApproval } from "@/hooks/use-approvals";
import { cn } from "@/lib/utils";
import { CheckCircle2Icon, CircleDashedIcon, Clock3Icon, ShieldCheckIcon } from "lucide-react";

type DesignWorkflowPanelProps = {
  design: DesignSummary;
  designId: string;
  employeeId?: number;
  canApprove: boolean;
  canExecute: boolean;
  canAssign: boolean;
};

export function DesignWorkflowPanel({
  design,
  designId,
  employeeId,
  canApprove,
  canExecute,
  canAssign,
}: DesignWorkflowPanelProps) {
  const router = useRouter();
  const assignTask = useAssignTask();
  const requestApproval = useRequestDesignApproval();

  const steps = useMemo(() => buildWorkflowSteps(design.tasks), [design.tasks]);
  const actions = useMemo(
    () =>
      getDesignWorkflowActions({
        design,
        employeeId,
        canApprove,
        canExecute,
        approvalsQueueHref: ROUTES.quality.approvals,
      }),
    [canApprove, canExecute, design, employeeId],
  );
  const statusMessage = useMemo(
    () => getWorkflowStatusMessage(steps, design.status),
    [design.status, steps],
  );

  const primaryAction = actions.find((a) => a.emphasis === "primary") ?? actions[0] ?? null;
  const secondaryActions = actions.filter((a) => a.id !== primaryAction?.id);

  async function handleTaskAction(action: DesignWorkflowAction) {
    if (!action.taskId || !employeeId) return;
    const task = design.tasks?.find((t) => t.id === action.taskId);
    if (
      task &&
      canAssign &&
      (!task.assignedEmployeeId || task.assignedEmployeeId !== employeeId)
    ) {
      await assignTask.mutateAsync({ taskId: task.id, employeeId });
    }
    router.push(ROUTES.work.taskDetail(action.taskId));
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Workflow & Approvals</h2>
            </div>
            {statusMessage ? (
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            ) : null}
          </div>
          <StatusBadge status={design.status} />
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.task.id}
              className={cn(
                "rounded-md border px-3 py-2.5 text-sm transition-colors",
                step.isCurrent
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    <span className="text-xs text-muted-foreground">#{step.sequence} </span>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.assigneeName ?? "Unassigned"}
                    {step.isApproval ? " · Approval stage" : ""}
                  </p>
                </div>
                <StepStatusIcon status={step.status} />
              </div>
              <div className="mt-2">
                <StatusBadge status={step.status} />
              </div>
            </li>
          ))}
        </ol>

        {(primaryAction || secondaryActions.length > 0) && (
          <div className="rounded-md border border-border bg-muted/15 p-4">
            <p className="text-sm font-medium text-foreground">Next action</p>
            {primaryAction ? (
              <p className="mt-1 text-sm text-muted-foreground">{primaryAction.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryAction ? (
                <WorkflowActionButton
                  action={primaryAction}
                  disabled={assignTask.isPending || requestApproval.isPending}
                  onTask={handleTaskAction}
                  onRequestApproval={() => requestApproval.mutate(designId)}
                />
              ) : null}
              {secondaryActions.map((action) => (
                <WorkflowActionButton
                  key={action.id}
                  action={action}
                  variant="outline"
                  disabled={assignTask.isPending || requestApproval.isPending}
                  onTask={handleTaskAction}
                  onRequestApproval={() => requestApproval.mutate(designId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkflowActionButton({
  action,
  variant = "default",
  disabled,
  onTask,
  onRequestApproval,
}: {
  action: DesignWorkflowAction;
  variant?: "default" | "outline";
  disabled?: boolean;
  onTask: (action: DesignWorkflowAction) => void;
  onRequestApproval: () => void;
}) {
  if (action.kind === "approvals_queue" && action.href) {
    return (
      <Link
        href={action.href}
        className={cn(buttonVariants({ variant, size: "sm" }))}
      >
        {action.label}
      </Link>
    );
  }

  if (action.kind === "request_approval") {
    return (
      <Button type="button" variant={variant} size="sm" disabled={disabled} onClick={onRequestApproval}>
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      onClick={() => onTask(action)}
    >
      {action.label}
    </Button>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED" || status === "CHECKING") {
    return <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (status === "RUNNING" || status === "ON_HOLD") {
    return <Clock3Icon className="size-4 shrink-0 text-primary" aria-hidden />;
  }
  return <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
