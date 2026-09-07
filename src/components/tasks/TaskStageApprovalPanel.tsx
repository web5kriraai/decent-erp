"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { FormTextArea } from "@/components/ui/form-text-area";
import { StatusBadge } from "@/components/StatusBadge";
import { ImageGallery } from "@/components/ImageGallery";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { useAssignTask, useCompleteStageApproval } from "@/hooks/use-tasks";
import { IconCheckCircle2, IconRotateCcw, IconXCircle } from "@/components/icons";
import { AppCard } from "@/components/ui/AppCard";
import {
  getStageApprovalBlockedMessage,
  isStageApprovalActionable,
} from "@/lib/design-workflow";
import {
  canRoleActOnStageApproval,
  getStageApprovalUiConfig,
  isStageApprovalCode,
  usesStageApprovalActionsNotTimerEnd,
  type StageApprovalCode,
} from "@/lib/stage-approval-rbac";
import type { HandoffContext } from "@/lib/handoff-context";

type TaskStageApprovalPanelProps = {
  taskId: string;
  designId: string;
  version: number;
  status: string;
  stageName: string;
  stageCode: string;
  assignedEmployeeId?: number | null;
  employeeId?: number;
  roleCode?: string;
  ownerRoleCode?: string | null;
  capabilities?: unknown;
  isApproval?: boolean;
  canAssign: boolean;
  showCompare?: boolean;
  workTaskStatus?: string;
  handoff?: HandoffContext | null;
};

export function isStageApprovalTask(
  code?: string,
  options?: { capabilities?: unknown; isApproval?: boolean },
) {
  return usesStageApprovalActionsNotTimerEnd(code, options);
}

function nextStepHintForApproval(code: string): string {
  if (!isStageApprovalCode(code)) return "Opens the next stage";
  switch (code as StageApprovalCode) {
    case "LIVE_REVIEW":
      return "Design goes live";
    case "FINAL_APPROVAL":
      return "Ready to request management approval";
    default:
      return "Opens the next stage";
  }
}

function approveLabelForCode(code: string, stageName: string): string {
  switch (code) {
    case "PUNCH_CHECK":
      return "Approve punch";
    case "LIVE_REVIEW":
      return "Approve go-live";
    default:
      return `Approve ${stageName.toLowerCase()}`;
  }
}

export function TaskStageApprovalPanel({
  taskId,
  designId,
  version,
  status,
  stageName,
  stageCode,
  assignedEmployeeId,
  employeeId,
  roleCode,
  ownerRoleCode,
  capabilities,
  isApproval,
  canAssign,
  showCompare = true,
  workTaskStatus,
  handoff,
}: TaskStageApprovalPanelProps) {
  const assignTask = useAssignTask();
  const completeStageApproval = useCompleteStageApproval();
  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uiConfig = getStageApprovalUiConfig(stageCode, capabilities, { isApproval });
  const roleAllowed = canRoleActOnStageApproval(roleCode, stageCode, {
    ownerRoleCode,
    capabilities,
  });
  const isOpen = !["COMPLETED", "CANCELLED", "CORRECTION_REQUIRED"].includes(status);

  // task_end_dialog stages (e.g. SAMPLE_CHECK) complete via End dialog - not this panel.
  if (
    !isOpen ||
    !uiConfig ||
    uiConfig.surface === "task_end_dialog" ||
    !roleAllowed
  ) {
    return null;
  }

  const showApprove = uiConfig.actions.includes("approve");
  const showCorrection = uiConfig.actions.includes("correction");
  const showReject = uiConfig.actions.includes("reject");

  // Only DESIGN_ASSIGN may reassign via /assign; owner roles without it rely on
  // completeStageApproval server takeover (same as InlineStageApprovalCard).
  const needsAssign =
    employeeId != null &&
    canAssign &&
    assignedEmployeeId != null &&
    assignedEmployeeId !== employeeId;

  async function resolveTaskVersion(): Promise<number> {
    let currentVersion = version;
    if (needsAssign && employeeId) {
      const updated = await assignTask.mutateAsync({ taskId, employeeId });
      currentVersion = updated.version;
    }
    return currentVersion;
  }

  async function submitDecision(decision: "APPROVED" | "REJECT" | "CORRECTION_REQUIRED") {
    if (decision !== "APPROVED" && !remark.trim()) return;
    setIsSubmitting(true);
    try {
      const currentVersion = await resolveTaskVersion();
      await completeStageApproval.mutateAsync({
        taskId,
        version: currentVersion,
        outputRemark:
          remark.trim() ||
          (decision === "APPROVED"
            ? `${stageName} approved`
            : decision === "REJECT"
              ? `${stageName} rejected`
              : `${stageName} correction requested`),
        decision,
      });
      setRemark("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = isSubmitting || assignTask.isPending || completeStageApproval.isPending;
  const workTask =
    workTaskStatus != null ? ({ status: workTaskStatus } as { status: string }) : undefined;
  const canApprove = isStageApprovalActionable(stageCode, workTask, capabilities);
  const approvalBlockedMessage = getStageApprovalBlockedMessage(
    stageCode,
    workTask,
    capabilities,
  );
  const panelTitle = uiConfig.title ?? `${stageName} - review decision`;

  const bannerContext: HandoffContext = handoff ?? {
    stageCode,
    stageName,
    status,
    nextStepHint: nextStepHintForApproval(stageCode),
    blockers: !canApprove && approvalBlockedMessage ? [approvalBlockedMessage] : undefined,
  };

  return (
    <>
      {showCompare && uiConfig.showCompare ? (
        <TaskCompareVersionsPanel designId={designId} />
      ) : null}

      <AppCard
        className="mb-4 border-primary/20"
        title={panelTitle}
        headerAction={<StatusBadge status={status} />}
        contentClassName="space-y-4"
      >
        <ActionHandoffBanner context={bannerContext} dense />

        {uiConfig.showGallery ? (
          <ImageGallery designId={designId} canUpload={false} />
        ) : null}

        {!canApprove && approvalBlockedMessage ? (
          <p className="text-sm text-muted-foreground" role="status">
            {approvalBlockedMessage}
          </p>
        ) : null}
        <FormTextArea
          id={`stage-decision-${taskId}`}
          label="Notes for the next worker (required for reject / correction)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Required for reject or correction request…"
          rows={3}
          disabled={!canApprove || busy}
          onEnterSubmit={
            canApprove && !busy && showApprove
              ? () => void submitDecision("APPROVED")
              : undefined
          }
        />
        <div className="flex flex-wrap gap-2">
          {showApprove ? (
            <AppButton
              type="button"
              disabled={busy || !canApprove}
              title={!canApprove ? approvalBlockedMessage : undefined}
              onClick={() => submitDecision("APPROVED")}
            >
              <IconCheckCircle2 className="size-4" aria-hidden />
              {approveLabelForCode(stageCode, stageName)}
            </AppButton>
          ) : null}
          {showCorrection ? (
            <AppButton
              type="button"
              appVariant="outline"
              disabled={busy || !canApprove || !remark.trim()}
              title={!canApprove ? approvalBlockedMessage : undefined}
              onClick={() => submitDecision("CORRECTION_REQUIRED")}
            >
              <IconRotateCcw className="size-4" aria-hidden />
              Request correction
            </AppButton>
          ) : null}
          {showReject ? (
            <AppButton
              type="button"
              appVariant="danger"
              disabled={busy || !canApprove || !remark.trim()}
              title={!canApprove ? approvalBlockedMessage : undefined}
              onClick={() => submitDecision("REJECT")}
            >
              <IconXCircle className="size-4" aria-hidden />
              Reject
            </AppButton>
          ) : null}
        </div>
      </AppCard>
    </>
  );
}
