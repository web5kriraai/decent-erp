"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { isDesignReadyForSignOff } from "@/lib/services/approval-queue-utils";
import { ROLE_CODES } from "@/lib/permissions";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import {
  buildWorkflowSteps,
  getDesignWorkflowContext,
  getWorkflowPanelHeaderStatus,
} from "@/lib/design-workflow";
import { canControlTask } from "@/lib/task-control-capability";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { cn } from "@/lib/utils";
import {
  IconCheckCircle2,
  IconCircleDashed,
  IconClock3,
  IconLock,
} from "@/components/icons";
import {
  formatTaskDeadline,
  formatTaskStamp,
  resolveTaskAssignedAt,
} from "@/lib/task-action-display";
import {
  formatMachineOutputSummary,
  isMachineOutputTask,
} from "@/lib/services/task-machine-output-utils";
import { computeTimeSummary, formatWorkingTotals } from "@/lib/services/time-calculation";

type DesignWorkflowPanelProps = {
  design: DesignSummary;
  designId: string;
  canAssign: boolean;
  onAssignTask?: (task: DesignTask) => void;
  /** Logged-in employee. Open is shown only when this person can do the task. */
  viewerEmployeeId?: number;
  viewerPermissions?: string[];
  viewerRoleCode?: string | null;
  /** Optional; management sign-off CTA lives on Approvals hub / request-sign-off page. */
  showSignOffCta?: boolean;
  /** Secondary workflow tools (e.g. override) - sits in the card header. */
  headerActions?: ReactNode;
};

export function DesignWorkflowPanel({
  design,
  designId,
  canAssign,
  onAssignTask,
  viewerEmployeeId,
  viewerPermissions = [],
  viewerRoleCode,
  headerActions,
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

  // Page header already shows design.status - only show a different stage badge here.
  const showHeaderBadge =
    workflowHeaderStatus.replace(/\s+/g, "_").toUpperCase() !==
    design.status.replace(/\s+/g, "_").toUpperCase();

  const statusLine =
    workflowContext.waitingMessage ??
    (workflowContext.nextAction
      ? [
          workflowContext.nextAction,
          workflowContext.nextOwner ? `· ${workflowContext.nextOwner}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null);

  const currentStep = steps.find((step) => step.isCurrent);
  const stageActiveSeconds = useMemo(
    () =>
      steps.map(
        (step) => computeTimeSummary(step.task.timeEvents ?? []).activeSeconds,
      ),
    [steps],
  );
  const totalActiveSeconds = stageActiveSeconds.reduce((sum, seconds) => sum + seconds, 0);

  const readyToSend =
    (design.status === "ACTIVE" || design.status === "DRAFT") &&
    isDesignReadyForSignOff(
      (design.tasks ?? []).map((task) => ({
        status: task.status,
        subProcess: {
          code: task.subProcess.code,
          isApproval: !!task.subProcess.isApproval,
          isFileRequired: task.subProcess.isFileRequired,
          capabilities: task.subProcess.capabilities,
        },
      })),
    );
  const canSend =
    viewerRoleCode === ROLE_CODES.DESIGN_HEAD || viewerRoleCode === ROLE_CODES.ADMIN;
  const sendHref = ROUTES.quality.requestSignOff(designId || design.id);

  const showNowStrip =
    Boolean(workflowContext.currentStage) ||
    Boolean(statusLine) ||
    Boolean(workflowContext.currentOwner);

  const headerAction =
    showHeaderBadge || headerActions ? (
      <div className="workflow-panel-header-actions">
        {showHeaderBadge ? <StatusBadge status={workflowHeaderStatus} /> : null}
        {headerActions}
      </div>
    ) : null;

  return (
    <AppCard
      title="Workflow"
      headerAction={headerAction}
      contentClassName="workflow-panel-body"
    >
      {readyToSend ? (
        <div className="erp-chain-notice" role="status">
          <p className="erp-chain-notice-title">Send this design to Management</p>
          <p className="erp-chain-notice-body">
            Design work is finished. This design has not been sent to Management, so Production Release cannot be completed.
          </p>
          {canSend ? (
            <AppButtonLink href={sendHref} size="sm">
              Send to Management
            </AppButtonLink>
          ) : (
            <p className="erp-chain-notice-body">
              Design Head opens this design and uses Send to Management.
            </p>
          )}
        </div>
      ) : null}
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
            {currentStep ? (
              <p className="workflow-now-meta">
                {currentStep.task.subProcess?.defaultRole?.name
                  ? `${currentStep.task.subProcess.defaultRole.name} · `
                  : ""}
                {`Assigned ${formatTaskStamp(resolveTaskAssignedAt(currentStep.task)) ?? "-"}`}
                {" · "}
                {`Deadline ${formatTaskDeadline(currentStep.task.dueAt) ?? "not set"}`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="workflow-stages">
        <div className="workflow-stages-head">
          <div className="min-w-0">
            <p className="workflow-stages-label">Pipeline stages</p>
            <p
              className="workflow-step-meta"
              title="Active work. A day is 8 hours, a week is 6 days, and a month is 4 weeks."
            >
              Total working {formatWorkingTotals(totalActiveSeconds)}
            </p>
          </div>
          <p className="workflow-stages-count">{steps.length}</p>
        </div>
        {steps.length === 0 ? (
          <p className="workflow-stages-empty">No workflow tasks yet.</p>
        ) : (
          <ol className="workflow-step-grid">
            {steps.map((step, index) => (
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
                      {[
                        step.task.subProcess?.defaultRole?.name,
                        step.displayStatus === "SCHEDULED" && step.assigneeName
                          ? `Scheduled · ${step.assigneeName}`
                          : step.isApproval && !step.isDone
                            ? `Pending approval · ${step.assigneeName ?? "Unassigned"}`
                            : (step.assigneeName ?? "Unassigned"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {step.task.skipReason ? ` · ${step.task.skipReason}` : ""}
                      {step.displayStatus === "ON_HOLD" && step.holdReasonName
                        ? ` · Hold · ${step.holdReasonName}`
                        : step.displayStatus === "ON_HOLD"
                          ? " · On hold"
                          : ""}
                    </p>
                    <p className="workflow-step-meta">
                      {`Assigned ${formatTaskStamp(resolveTaskAssignedAt(step.task)) ?? "-"}`}
                      {" · "}
                      {`Deadline ${formatTaskDeadline(step.task.dueAt) ?? "not set"}`}
                    </p>
                    {(stageActiveSeconds[index] ?? 0) > 0 ? (
                      <p className="workflow-step-meta">
                        Worked {formatWorkingTotals(stageActiveSeconds[index] ?? 0)}
                      </p>
                    ) : null}
                    {step.isDone && step.task.completedAt ? (
                      <p className="workflow-step-meta">
                        Submitted {formatTaskStamp(step.task.completedAt)}
                      </p>
                    ) : null}
                    {isMachineOutputTask(step.task.subProcess?.code) ? (
                      <p className="workflow-step-meta">
                        {formatMachineOutputSummary(step.task.artifacts?.[0]) ??
                          "Machine output not recorded"}
                      </p>
                    ) : null}
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
                  {step.isCurrent &&
                  step.task.id &&
                  canControlTask({
                    permissions: viewerPermissions,
                    employeeId: viewerEmployeeId,
                    roleCode: viewerRoleCode,
                    task: {
                      status: step.task.status,
                      assignedEmployeeId: step.task.assignedEmployeeId,
                      subProcess: {
                        code: step.task.subProcess?.code ?? "",
                        isApproval: step.task.subProcess?.isApproval,
                        capabilities: step.task.subProcess?.capabilities,
                        defaultRole: step.task.subProcess?.defaultRole,
                      },
                    },
                  }) ? (
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
    return <IconLock className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (step.status === "SKIPPED" || step.displayStatus === "SKIPPED") {
    return <IconCircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (step.isDone || step.displayStatus === "COMPLETED") {
    return <IconCheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (step.isCurrent || step.status === "RUNNING" || step.status === "ON_HOLD") {
    return <IconClock3 className="size-4 shrink-0 text-primary" aria-hidden />;
  }
  return <IconCircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
