"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormTextArea } from "@/components/ui/form-text-area";
import { ImageGallery } from "@/components/ImageGallery";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { useAssignTask, useCompleteStageApproval } from "@/hooks/use-tasks";
import { queryKeys } from "@/lib/query-keys";
import {
  getStageApprovalBlockedMessage,
  isStageApprovalActionable,
} from "@/lib/design-workflow";
import {
  getStageApprovalUiConfig,
  isStageApprovalCode,
} from "@/lib/stage-approval-rbac";
import type { DesignSummary, DesignTask } from "@/lib/types/api";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import type { HandoffContext } from "@/lib/handoff-context";
import { IconCheckCircle2, IconRotateCcw, IconXCircle } from "@/components/icons";

type InlineStageApprovalCardProps = {
  designId: string;
  design: DesignSummary;
  approvalTask: DesignTask;
  workTask?: DesignTask;
  employeeId?: number;
  canAssign: boolean;
  costingTotal?: number | null;
  costingEntryCount?: number | null;
  sampleOutcome?: string | null;
};

function nextStepHintForApproval(code: string): string {
  switch (code) {
    case "CONCEPT_REVIEW":
      return "Sketch Designer starts sketching";
    case "SKETCH_APPROVAL":
      return "Punching Designer receives approved sketch";
    case "FINAL_APPROVAL":
      return "Approve for production when stages are done";
    case "PUNCH_CHECK":
      return "Material / fabric issue toward sample";
    case "SAMPLE_CHECK":
      return "Costing Team enters development costs";
    case "LIVE_REVIEW":
      return "Design goes LIVE · ERP chain unlocks";
    default:
      return "Advances the workflow to the next stage";
  }
}

function approveLabelForCode(code: string): string {
  switch (code) {
    case "CONCEPT_REVIEW":
      return "Approve concept";
    case "SKETCH_APPROVAL":
      return "Approve sketch";
    case "FINAL_APPROVAL":
      return "Approve for sign-off";
    default:
      return "Approve";
  }
}

export function InlineStageApprovalCard({
  designId,
  design,
  approvalTask,
  workTask,
  employeeId,
  canAssign,
  costingTotal,
  costingEntryCount,
  sampleOutcome,
}: InlineStageApprovalCardProps) {
  const queryClient = useQueryClient();
  const assignTask = useAssignTask();
  const completeStageApproval = useCompleteStageApproval();

  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stageName = approvalTask.subProcess?.name ?? "Stage";
  const approvalCode = approvalTask.subProcess?.code ?? "";
  const capabilities = approvalTask.subProcess?.capabilities;
  const isApproval = approvalTask.subProcess?.isApproval;

  if (!isStageApprovalCode(approvalCode)) return null;

  const uiConfig = getStageApprovalUiConfig(approvalCode, capabilities, { isApproval });
  if (!uiConfig || uiConfig.surface !== "inline_card") return null;

  const canApprove = isStageApprovalActionable(approvalCode, workTask, capabilities);
  const approvalBlockedMessage = getStageApprovalBlockedMessage(
    approvalCode,
    workTask,
    capabilities,
  );
  const showApprove = uiConfig.actions.includes("approve");
  const showCorrection = uiConfig.actions.includes("correction");
  const showReject = uiConfig.actions.includes("reject");

  const handoff: HandoffContext = {
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
    productType: design.productType?.name ?? null,
    priority: design.priority,
    stageCode: approvalCode,
    stageName,
    status: approvalTask.status,
    nextStepHint: nextStepHintForApproval(approvalCode),
    priorStage: workTask
      ? {
          code: workTask.subProcess?.code,
          name: workTask.subProcess?.name ?? "Prior stage",
          status: workTask.status,
          outputRemark: workTask.outputRemark,
          assigneeName: workTask.assignedEmployee?.name,
        }
      : null,
    costingTotal: costingTotal ?? null,
    costingEntryCount: costingEntryCount ?? null,
    sampleOutcome: sampleOutcome ?? null,
    blockers: !canApprove && approvalBlockedMessage ? [approvalBlockedMessage] : undefined,
  };

  async function refreshDesign() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(designId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
  }

  async function resolveApprovalTask(): Promise<DesignTask> {
    await queryClient.refetchQueries({ queryKey: queryKeys.designs.detail(designId) });
    const freshDesign = queryClient.getQueryData<DesignSummary>(
      queryKeys.designs.detail(designId),
    );
    let current =
      freshDesign?.tasks?.find((task) => task.id === approvalTask.id) ?? approvalTask;

    // Owner may take over via assign when they have DESIGN_ASSIGN; otherwise
    // completeStageApproval reassigns on the server for the owner role.
    if (
      employeeId &&
      canAssign &&
      (!current.assignedEmployeeId || current.assignedEmployeeId !== employeeId)
    ) {
      current = await assignTask.mutateAsync({ taskId: current.id, employeeId });
      await queryClient.refetchQueries({ queryKey: queryKeys.designs.detail(designId) });
      const afterAssign = queryClient.getQueryData<DesignSummary>(
        queryKeys.designs.detail(designId),
      );
      current = afterAssign?.tasks?.find((task) => task.id === approvalTask.id) ?? current;
    }

    return current;
  }

  async function handleApprove() {
    setIsSubmitting(true);
    try {
      const current = await resolveApprovalTask();
      await completeStageApproval.mutateAsync({
        taskId: current.id,
        version: current.version,
        outputRemark: remark.trim() || `${stageName} approved`,
      });
      setRemark("");
      await refreshDesign();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendBack() {
    if (!remark.trim()) return;

    setIsSubmitting(true);
    try {
      const current = await resolveApprovalTask();
      await completeStageApproval.mutateAsync({
        taskId: current.id,
        version: current.version,
        outputRemark: remark.trim(),
        decision: "CORRECTION_REQUIRED",
      });
      setRemark("");
      await refreshDesign();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!remark.trim()) return;

    setIsSubmitting(true);
    try {
      const current = await resolveApprovalTask();
      await completeStageApproval.mutateAsync({
        taskId: current.id,
        version: current.version,
        outputRemark: remark.trim(),
        decision: "REJECT",
      });
      setRemark("");
      await refreshDesign();
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy =
    isSubmitting ||
    assignTask.isPending ||
    completeStageApproval.isPending;

  const cardTitle = uiConfig.title ?? stageName;

  return (
    <AppCard
      className="mb-4"
      title={cardTitle}
      description={!canApprove ? approvalBlockedMessage : undefined}
      headerAction={
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={approvalTask.status} />
          {workTask ? <StatusBadge status={resolveListItemDisplayStatus(workTask)} /> : null}
        </div>
      }
    >
      <div className="space-y-4">
        <ActionHandoffBanner context={handoff} dense />

        {uiConfig.showCompare ? <TaskCompareVersionsPanel designId={designId} /> : null}

        {uiConfig.showGallery ? (
          <ImageGallery designId={designId} canUpload={false} />
        ) : null}

        <FormTextArea
          id="stage-approval-remark"
          label="Notes for the next worker (required for reject / correction)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={2}
          disabled={busy || !canApprove}
          onEnterSubmit={
            canApprove && !busy && showApprove ? () => void handleApprove() : undefined
          }
        />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          {showReject ? (
            <AppButton
              type="button"
              appVariant="danger"
              size="sm"
              disabled={busy || !canApprove || !remark.trim()}
              onClick={handleReject}
            >
              <IconXCircle className="size-4" aria-hidden />
              Reject
            </AppButton>
          ) : null}
          {showCorrection ? (
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              disabled={busy || !canApprove || !remark.trim()}
              onClick={handleSendBack}
            >
              <IconRotateCcw className="size-4" aria-hidden />
              Request correction
            </AppButton>
          ) : null}
          {showApprove ? (
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={busy || !canApprove}
              title={!canApprove ? approvalBlockedMessage : undefined}
              onClick={handleApprove}
            >
              <IconCheckCircle2 className="size-4" aria-hidden />
              {approveLabelForCode(approvalCode)}
            </AppButton>
          ) : null}
        </div>
      </div>
    </AppCard>
  );
}
