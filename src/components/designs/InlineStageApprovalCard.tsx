"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormTextArea } from "@/components/ui/form-text-area";
import { ImageGallery } from "@/components/ImageGallery";
import { StatusBadge } from "@/components/StatusBadge";
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
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from "lucide-react";

type InlineStageApprovalCardProps = {
  designId: string;
  design: DesignSummary;
  approvalTask: DesignTask;
  workTask?: DesignTask;
  employeeId?: number;
  canAssign: boolean;
};

export function InlineStageApprovalCard({
  designId,
  approvalTask,
  workTask,
  employeeId,
  canAssign,
}: InlineStageApprovalCardProps) {
  const queryClient = useQueryClient();
  const assignTask = useAssignTask();
  const completeStageApproval = useCompleteStageApproval();

  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stageName = approvalTask.subProcess?.name ?? "Stage";
  const approvalCode = approvalTask.subProcess?.code ?? "";

  if (!isStageApprovalCode(approvalCode)) return null;

  const uiConfig = getStageApprovalUiConfig(approvalCode);
  if (!uiConfig || uiConfig.surface !== "inline_card") return null;

  const canApprove = isStageApprovalActionable(approvalCode, workTask);
  const approvalBlockedMessage = getStageApprovalBlockedMessage(approvalCode, workTask);
  const showApprove = uiConfig.actions.includes("approve");
  const showCorrection = uiConfig.actions.includes("correction");
  const showReject = uiConfig.actions.includes("reject");

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

  const cardTitle = uiConfig.title ?? `${stageName} — your action`;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border-2 border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
      <div className="border-b border-primary/15 bg-primary/5 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold text-foreground">{cardTitle}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {canApprove
                ? `Review the design and record your ${stageName.toLowerCase()} decision without leaving this page.`
                : approvalBlockedMessage}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={approvalTask.status} />
            {workTask ? <StatusBadge status={resolveListItemDisplayStatus(workTask)} /> : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        {uiConfig.showCompare ? <TaskCompareVersionsPanel designId={designId} /> : null}

        {uiConfig.showGallery ? (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Design files to review</p>
            <ImageGallery designId={designId} canUpload={false} />
          </div>
        ) : null}

        <FormTextArea
          id="stage-approval-remark"
          label="Review notes (optional for approval, required to send back)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Add approval notes or feedback…"
          rows={3}
        />

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {showApprove ? (
            <Button
              type="button"
              size="lg"
              disabled={busy || !canApprove}
              title={!canApprove ? approvalBlockedMessage : undefined}
              onClick={handleApprove}
              className="min-w-[10rem]"
            >
              <CheckCircle2Icon className="size-4" aria-hidden />
              Approve {stageName.toLowerCase()}
            </Button>
          ) : null}
          {showCorrection ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy || !canApprove || !remark.trim()}
              onClick={handleSendBack}
            >
              <RotateCcwIcon className="size-4" aria-hidden />
              Request correction
            </Button>
          ) : null}
          {showReject ? (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={busy || !canApprove || !remark.trim()}
              onClick={handleReject}
            >
              <XCircleIcon className="size-4" aria-hidden />
              Reject
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
