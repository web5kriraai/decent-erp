"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { FormTextArea } from "@/components/ui/form-text-area";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { useAssignTask, useCompleteStageApproval } from "@/hooks/use-tasks";
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import {
  getStageApprovalBlockedMessage,
  isStageApprovalActionable,
} from "@/lib/design-workflow";
import {
  canRoleActOnStageApproval,
  getStageApprovalUiConfig,
  isStageApprovalCode,
} from "@/lib/stage-approval-rbac";

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
  canAssign: boolean;
  showCompare?: boolean;
  workTaskStatus?: string;
};

export function isStageApprovalTask(code?: string) {
  if (!code || !isStageApprovalCode(code)) return false;
  const config = getStageApprovalUiConfig(code);
  return config?.surface === "task_panel";
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
  canAssign,
  showCompare = true,
  workTaskStatus,
}: TaskStageApprovalPanelProps) {
  const assignTask = useAssignTask();
  const completeStageApproval = useCompleteStageApproval();
  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uiConfig = getStageApprovalUiConfig(stageCode);
  const roleAllowed = canRoleActOnStageApproval(roleCode, stageCode);
  const isOpen = !["COMPLETED", "CANCELLED", "CORRECTION_REQUIRED"].includes(status);

  if (!isOpen || !uiConfig || uiConfig.surface !== "task_panel" || !roleAllowed) return null;

  const showApprove = uiConfig.actions.includes("approve");
  const showCorrection = uiConfig.actions.includes("correction");
  const showReject = uiConfig.actions.includes("reject");

  const needsAssign =
    employeeId &&
    canAssign &&
    assignedEmployeeId != null &&
    assignedEmployeeId !== employeeId;
  const notMyTask =
    assignedEmployeeId != null && employeeId != null && assignedEmployeeId !== employeeId;

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
  const canApprove = isStageApprovalActionable(stageCode, workTask);
  const approvalBlockedMessage = getStageApprovalBlockedMessage(stageCode, workTask);
  const panelTitle = uiConfig.title ?? `${stageName} — review decision`;

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
        {notMyTask && !canAssign ? (
          <p className="text-sm text-muted-foreground">
            This approval is assigned to another checker.
          </p>
        ) : (
          <>
            {!canApprove && approvalBlockedMessage ? (
              <p className="text-sm text-muted-foreground" role="status">
                {approvalBlockedMessage}
              </p>
            ) : null}
            <FormTextArea
              id={`stage-decision-${taskId}`}
              label="Review notes"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Required for reject or correction request…"
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {showApprove ? (
                <AppButton
                  type="button"
                  disabled={busy || !canApprove}
                  title={!canApprove ? approvalBlockedMessage : undefined}
                  onClick={() => submitDecision("APPROVED")}
                >
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  Approve {stageName.toLowerCase()}
                </AppButton>
              ) : null}
              {showCorrection ? (
                <AppButton
                  type="button"
                  appVariant="outline"
                  disabled={busy || !canApprove || !remark.trim()}
                  onClick={() => submitDecision("CORRECTION_REQUIRED")}
                >
                  <RotateCcwIcon className="size-4" aria-hidden />
                  Request correction
                </AppButton>
              ) : null}
              {showReject ? (
                <AppButton
                  type="button"
                  appVariant="danger"
                  disabled={busy || !canApprove || !remark.trim()}
                  onClick={() => submitDecision("REJECT")}
                >
                  <XCircleIcon className="size-4" aria-hidden />
                  Reject
                </AppButton>
              ) : null}
            </div>
          </>
        )}
      </AppCard>
    </>
  );
}
