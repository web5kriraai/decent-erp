"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormTextArea } from "@/components/ui/form-text-area";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { useAssignTask, useCompleteStageApproval } from "@/hooks/use-tasks";
import { CheckCircle2Icon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAGE_APPROVAL_CODES = new Set(["PUNCH_CHECK", "SKETCH_APPROVAL", "CONCEPT_REVIEW", "FINAL_APPROVAL"]);

type TaskStageApprovalPanelProps = {
  taskId: string;
  designId: string;
  version: number;
  status: string;
  stageName: string;
  stageCode: string;
  assignedEmployeeId?: number | null;
  employeeId?: number;
  canAssign: boolean;
  showCompare?: boolean;
};

export function isStageApprovalTask(code?: string) {
  return !!code && STAGE_APPROVAL_CODES.has(code);
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
  canAssign,
  showCompare = true,
}: TaskStageApprovalPanelProps) {
  const assignTask = useAssignTask();
  const completeStageApproval = useCompleteStageApproval();
  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = !["COMPLETED", "CANCELLED", "CORRECTION_REQUIRED"].includes(status);
  if (!isOpen) return null;

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

  return (
    <>
      {showCompare && (stageCode === "PUNCH_CHECK" || stageCode === "SKETCH_APPROVAL") ? (
        <TaskCompareVersionsPanel designId={designId} />
      ) : null}

      <Card className="mb-4 border-primary/20">
        <CardHeader className="border-b border-primary/10 bg-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{stageName} — review decision</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {notMyTask && !canAssign ? (
            <p className="text-sm text-muted-foreground">
              This approval is assigned to another checker.
            </p>
          ) : (
            <>
              <FormTextArea
                id={`stage-decision-${taskId}`}
                label="Review notes"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Required for reject or correction request…"
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => submitDecision("APPROVED")}
                >
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !remark.trim()}
                  onClick={() => submitDecision("CORRECTION_REQUIRED")}
                >
                  <RotateCcwIcon className="size-4" aria-hidden />
                  Request correction
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || !remark.trim()}
                  onClick={() => submitDecision("REJECT")}
                >
                  <XCircleIcon className="size-4" aria-hidden />
                  Reject
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
