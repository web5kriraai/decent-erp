"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormTextArea } from "@/components/ui/form-text-area";
import { ImageGallery } from "@/components/ImageGallery";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import {
  DesignerTimePanel,
  type DesignerTimeStage,
} from "@/components/tasks/DesignerTimePanel";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { useAssignTask, useCompleteStageApproval } from "@/hooks/use-tasks";
import { COST_ENTRY_TYPES, extractCostingAdditionalNote } from "@/lib/services/costing-end-utils";
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
import type { HandoffContext } from "@/lib/handoff-context";
import { computeTimeSummary } from "@/lib/services/time-calculation";
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
  costByType?: Record<string, number> | null;
  estimatedCost?: number | null;
  sampleOutcome?: string | null;
};

const COST_TYPE_LABEL: Record<string, string> = {
  TIME: "Time",
  MATERIAL: "Material",
  MACHINE: "Machine",
  CORRECTION: "Correction rework",
};

function inr(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function amountsByType(
  design: DesignSummary,
  costByType?: Record<string, number> | null,
): Record<string, number> {
  if (costByType) return costByType;
  const totals: Record<string, number> = {};
  for (const cost of design.costs ?? []) {
    const amount = Number(cost.amount);
    if (!Number.isFinite(amount)) continue;
    totals[cost.costType] = (totals[cost.costType] ?? 0) + amount;
  }
  return totals;
}

function stageTimesBefore(design: DesignSummary, beforeSequence: number): DesignerTimeStage[] {
  return (design.tasks ?? [])
    .filter((task) => task.sequence < beforeSequence)
    .sort((a, b) => a.sequence - b.sequence)
    .map((task) => {
      const time = task.timeEvents?.length ? computeTimeSummary(task.timeEvents) : null;
      return {
        id: task.id,
        sequence: task.sequence,
        status: task.status,
        expectedMinutes: task.expectedMinutes,
        activeSeconds: time?.activeSeconds ?? 0,
        holdSeconds: time?.holdSeconds ?? 0,
        subProcess: {
          name: task.subProcess.name,
          code: task.subProcess.code,
          defaultRole: task.subProcess.defaultRole
            ? { name: task.subProcess.defaultRole.name ?? null }
            : null,
        },
        assignedEmployee: task.assignedEmployee ? { name: task.assignedEmployee.name } : null,
      };
    });
}

function nextTaskAfter(current: DesignTask, tasks: DesignTask[] | undefined): DesignTask | null {
  if (!tasks?.length) return null;
  return (
    tasks
      .filter((task) => task.id !== current.id && task.sequence > current.sequence)
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}

function nextStepHintForApproval(code: string): string {
  switch (code) {
    case "LIVE_REVIEW":
      return "Complete live review, then mark the design live";
    case "FINAL_APPROVAL":
      return "Send to Management for production approval";
    default:
      return "Opens the next stage";
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
  costByType,
  estimatedCost,
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

  const nextTask = nextTaskAfter(approvalTask, design.tasks);
  const isFinalApproval = approvalCode === "FINAL_APPROVAL";
  const costAmounts = isFinalApproval ? amountsByType(design, costByType) : null;
  const costTotal = costAmounts
    ? COST_ENTRY_TYPES.reduce((sum, type) => sum + Number(costAmounts[type] ?? 0), 0)
    : null;
  const baseline =
    estimatedCost ??
    design.detailMeta?.costSummary.estimatedCost ??
    design.estimatedCost ??
    null;
  const stageTimes = isFinalApproval
    ? stageTimesBefore(design, approvalTask.sequence)
    : [];
  const priorRemark = isFinalApproval
    ? extractCostingAdditionalNote(workTask?.outputRemark)
    : workTask?.outputRemark;
  const workTime =
    !isFinalApproval && workTask?.timeEvents?.length
      ? computeTimeSummary(workTask.timeEvents)
      : null;
  const handoff: HandoffContext = {
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
    productType: design.productType?.name ?? null,
    priority: design.priority,
    stageCode: approvalCode,
    stageName,
    status: approvalTask.status,
    nextStepHint: nextTask ? null : nextStepHintForApproval(approvalCode),
    nextStage: nextTask
      ? {
          code: nextTask.subProcess?.code,
          name: nextTask.subProcess?.name ?? "Next stage",
          status: nextTask.status,
          assigneeName: nextTask.assignedEmployee?.name ?? null,
        }
      : null,
    priorStage: workTask
      ? {
          code: workTask.subProcess?.code,
          name: workTask.subProcess?.name ?? "Prior stage",
          status: workTask.status,
          outputRemark: priorRemark,
          assigneeName: workTask.assignedEmployee?.name,
        }
      : null,
    activeSeconds: workTime?.activeSeconds ?? null,
    holdSeconds: workTime?.holdSeconds ?? null,
    expectedMinutes: workTime ? (workTask?.expectedMinutes ?? null) : null,
    timeSectionTitle: workTask
      ? `${workTask.subProcess?.name ?? "Submitted work"} time`
      : null,
    costingTotal: isFinalApproval ? null : (costingTotal ?? null),
    costingEntryCount: isFinalApproval ? null : (costingEntryCount ?? null),
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
      headerAction={<StatusBadge status={approvalTask.status} />}
    >
      <div className="space-y-4">
        <ActionHandoffBanner context={handoff} />

        {isFinalApproval && costAmounts && costTotal != null ? (
          <section className="handoff-group" aria-label="Development costs">
            <p className="handoff-group-title">Development costs</p>
            <div className="handoff-metrics">
              {COST_ENTRY_TYPES.map((type) => (
                <div className="handoff-tile" key={type}>
                  <span className="handoff-tile-label">{COST_TYPE_LABEL[type]}</span>
                  <div className="handoff-tile-value">
                    <p className="handoff-metric-value">{inr(Number(costAmounts[type] ?? 0))}</p>
                  </div>
                </div>
              ))}
              <div className="handoff-tile">
                <span className="handoff-tile-label">Total</span>
                <div className="handoff-tile-value">
                  <p className="handoff-metric-value">{inr(costTotal)}</p>
                </div>
              </div>
              {baseline != null ? (
                <div className="handoff-tile">
                  <span className="handoff-tile-label">Vs estimate</span>
                  <div className="handoff-tile-value">
                    <p className="handoff-metric-value">{inr(baseline - costTotal)}</p>
                    <p className="handoff-metric-sub">Estimate {inr(baseline)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {isFinalApproval ? (
          <section className="handoff-group" aria-label="Stage time">
            <p className="handoff-group-title">Stage time</p>
            <DesignerTimePanel stages={stageTimes} />
          </section>
        ) : null}

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
