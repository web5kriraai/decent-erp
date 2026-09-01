"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildWorkflowSteps,
  getDesignWorkflowContext,
} from "@/lib/design-workflow";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon,
} from "lucide-react";

type DesignWorkflowPanelProps = {
  design: DesignSummary;
  designId: string;
  canAssign: boolean;
  onAssignTask?: (task: DesignTask) => void;
};

export function DesignWorkflowPanel({
  design,
  canAssign,
  onAssignTask,
}: DesignWorkflowPanelProps) {
  const steps = useMemo(() => buildWorkflowSteps(design.tasks), [design.tasks]);
  const workflowContext = useMemo(
    () => getDesignWorkflowContext({ status: design.status, tasks: design.tasks }),
    [design.status, design.tasks],
  );

  return (
    <section className="workflow-panel">
      <div className="workflow-panel-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">Workflow</h2>
          </div>
          {workflowContext.summary ? (
            <p className="text-sm text-muted-foreground">{workflowContext.summary}</p>
          ) : null}
        </div>
        <StatusBadge status={design.status} />
      </div>

      <div className="workflow-panel-body">
        {(workflowContext.currentStage ||
          workflowContext.currentOwner ||
          workflowContext.nextAction) && (
          <dl className="workflow-context-grid">
            {workflowContext.currentStage ? (
              <>
                <dt>Current stage</dt>
                <dd>{workflowContext.currentStage}</dd>
              </>
            ) : null}
            {workflowContext.currentOwner ? (
              <>
                <dt>Current owner</dt>
                <dd>{workflowContext.currentOwner}</dd>
              </>
            ) : null}
            {workflowContext.nextAction ? (
              <>
                <dt>Next action</dt>
                <dd>{workflowContext.nextAction}</dd>
              </>
            ) : null}
            {workflowContext.nextOwner ? (
              <>
                <dt>Next owner</dt>
                <dd>{workflowContext.nextOwner}</dd>
              </>
            ) : null}
          </dl>
        )}

        <ol className="workflow-step-grid">
          {steps.map((step) => (
            <li
              key={step.task.id}
              className={cn(
                "workflow-step-card",
                step.isCurrent && "workflow-step-card--current",
                step.isUpcoming && "workflow-step-card--upcoming",
                step.isDone && "workflow-step-card--done",
              )}
            >
              <div className="workflow-step-card-head">
                <div className="min-w-0">
                  <p className="workflow-step-title">
                    <span className="workflow-step-seq">#{step.sequence} </span>
                    {step.label}
                  </p>
                  <p className="workflow-step-meta">
                    {step.assigneeName ?? "Unassigned"}
                    {step.isApproval ? " · Approval" : ""}
                    {step.task.skipReason ? ` · ${step.task.skipReason}` : ""}
                  </p>
                </div>
                <StepStatusIcon step={step} />
              </div>
              <div className="workflow-step-card-foot">
                <StatusBadge status={step.displayStatus} />
                {canAssign && step.canReassign && onAssignTask ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="workflow-reassign-btn"
                    onClick={() => onAssignTask(step.task)}
                  >
                    Reassign
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {workflowContext.nextActionHint ? (
          <div className="workflow-next-hint" role="note">
            <InfoIcon className="workflow-next-hint-icon" aria-hidden />
            <div>
              <p className="workflow-next-hint-title">Next action</p>
              <p className="workflow-next-hint-text">{workflowContext.nextActionHint}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StepStatusIcon({
  step,
}: {
  step: {
    isDone: boolean;
    isUpcoming: boolean;
    isCurrent: boolean;
    status: string;
    displayStatus: string;
  };
}) {
  if (step.isUpcoming) {
    return <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (step.status === "SKIPPED" || step.displayStatus === "SKIPPED") {
    return <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (step.isDone || step.displayStatus === "COMPLETED") {
    return <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (step.isCurrent || step.status === "RUNNING" || step.status === "ON_HOLD") {
    return <Clock3Icon className="size-4 shrink-0 text-primary" aria-hidden />;
  }
  if (step.status === "CHECKING") {
    return <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
