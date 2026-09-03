"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import {
  buildWorkflowSteps,
  getDesignWorkflowContext,
  getWorkflowPanelHeaderStatus,
} from "@/lib/design-workflow";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  LockIcon,
} from "lucide-react";

type DesignWorkflowPanelProps = {
  design: DesignSummary;
  designId: string;
  canAssign: boolean;
  onAssignTask?: (task: DesignTask) => void;
  /** When false, omit sign-off CTA (already shown elsewhere on the page). */
  showSignOffCta?: boolean;
};

const SIGN_OFF_LEVELS = [
  { level: 1, label: "Sample Checker" },
  { level: 2, label: "Design Head" },
  { level: 3, label: "Management" },
] as const;

export function DesignWorkflowPanel({
  design,
  canAssign,
  onAssignTask,
  showSignOffCta = true,
}: DesignWorkflowPanelProps) {
  const steps = useMemo(() => buildWorkflowSteps(design.tasks), [design.tasks]);
  const workflowContext = useMemo(
    () => getDesignWorkflowContext({ status: design.status, tasks: design.tasks }),
    [design.status, design.tasks],
  );
  const workflowHeaderStatus = useMemo(
    () =>
      getWorkflowPanelHeaderStatus({
        designStatus: design.status,
        steps,
        workflowContext,
      }),
    [design.status, steps, workflowContext],
  );

  const isSignOff = design.status === "APPROVAL_PENDING";
  // Page header already shows design.status — only show a different stage badge here.
  const showHeaderBadge =
    !isSignOff &&
    workflowHeaderStatus.replace(/\s+/g, "_").toUpperCase() !==
      design.status.replace(/\s+/g, "_").toUpperCase();

  const statusLine = isSignOff
    ? null
    : workflowContext.waitingMessage ??
      (workflowContext.nextAction
        ? [
            workflowContext.nextAction,
            workflowContext.nextOwner ? `· ${workflowContext.nextOwner}` : null,
          ]
            .filter(Boolean)
            .join(" ")
        : null);

  const showNowStrip =
    Boolean(workflowContext.currentStage) ||
    Boolean(statusLine) ||
    Boolean(workflowContext.currentOwner) ||
    (isSignOff && showSignOffCta);

  return (
    <AppCard
      title="Workflow"
      headerAction={showHeaderBadge ? <StatusBadge status={workflowHeaderStatus} /> : null}
      contentClassName="workflow-panel-body"
    >
      {showNowStrip ? (
        <div className="workflow-now">
          <div className="workflow-now-main">
            <p className="workflow-now-title">
              {workflowContext.currentStage ?? "Pipeline in progress"}
            </p>
            {workflowContext.currentOwner ? (
              <p className="workflow-now-meta">
                Owner · <strong>{workflowContext.currentOwner}</strong>
              </p>
            ) : null}
            {statusLine ? <p className="workflow-now-meta">{statusLine}</p> : null}
          </div>
          {isSignOff && showSignOffCta ? (
            <AppButtonLink
              href={`${ROUTES.quality.approvals}?tab=management`}
              appVariant="primary"
              size="sm"
              className="workflow-now-cta"
            >
              Open Management Sign-off
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </AppButtonLink>
          ) : null}
        </div>
      ) : null}

      {isSignOff ? (
        <div className="workflow-signoff" aria-label="Management sign-off chain">
          <ol className="workflow-signoff-track">
            {SIGN_OFF_LEVELS.map((item, index) => (
              <li key={item.level} className="workflow-signoff-item">
                {index > 0 ? (
                  <span className="workflow-signoff-connector" aria-hidden />
                ) : null}
                <div className="workflow-signoff-node">
                  <span className="workflow-signoff-level">L{item.level}</span>
                  <span className="workflow-signoff-role">{item.label}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="workflow-stages">
        <div className="workflow-stages-head">
          <p className="workflow-stages-label">Pipeline stages</p>
          <p className="workflow-stages-count">{steps.length}</p>
        </div>
        {steps.length === 0 ? (
          <p className="workflow-stages-empty">No workflow tasks yet.</p>
        ) : (
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
                      <span className="workflow-step-seq">{step.sequence}</span>
                      {step.label}
                    </p>
                    <p className="workflow-step-meta">
                      {step.assigneeName ?? "Unassigned"}
                      {step.isApproval ? " · Approval" : ""}
                      {step.task.skipReason ? ` · ${step.task.skipReason}` : ""}
                      {step.displayStatus === "ON_HOLD" && step.holdReasonName
                        ? ` · Hold · ${step.holdReasonName}`
                        : step.displayStatus === "ON_HOLD"
                          ? " · On hold"
                          : ""}
                    </p>
                  </div>
                  <StepStatusIcon step={step} />
                </div>
                <div className="workflow-step-card-foot">
                  <StatusBadge status={step.displayStatus} />
                  {canAssign && step.canReassign && onAssignTask ? (
                    <AppButton
                      type="button"
                      appVariant="outline"
                      size="xs"
                      className="workflow-reassign-btn"
                      onClick={() => onAssignTask(step.task)}
                    >
                      Reassign
                    </AppButton>
                  ) : null}
                  {step.isCurrent && step.task.id ? (
                    <Link
                      href={ROUTES.work.taskDetail(step.task.id)}
                      className="workflow-step-open"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppCard>
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
  return <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
