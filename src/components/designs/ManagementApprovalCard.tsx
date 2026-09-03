"use client";

import { useState } from "react";
import {
  Modal,
  ModalFooterActions,
} from "@/components/ui/Modal";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ROUTES } from "@/config/routes";
import { usePendingApprovals, useSubmitApproval } from "@/hooks/use-approvals";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { parseApprovalRequestPackage } from "@/lib/approval-request-package";
import {
  ApprovalDecisionForm,
  defaultApprovalDecisionFormState,
  isApprovalDecisionFormValid,
  type ApprovalDecisionFormState,
} from "@/components/approvals/ApprovalDecisionForm";

type ManagementApprovalCardProps = {
  designId: string;
  ideaRef: string;
};

export function ManagementApprovalCard({ designId, ideaRef }: ManagementApprovalCardProps) {
  const pendingQuery = usePendingApprovals(true);
  const submitApproval = useSubmitApproval();
  const [formState, setFormState] = useState<ApprovalDecisionFormState>(
    defaultApprovalDecisionFormState(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const employeesQuery = useEmployeeOptions(modalOpen);

  const pendingItem = (pendingQuery.data ?? []).find((item) => item.designId === designId);
  if (!pendingItem) return null;

  const requestPackage = parseApprovalRequestPackage(pendingItem.approvalRequestPackage);

  async function handleSubmit() {
    if (!isApprovalDecisionFormValid(formState, pendingItem!.costingReady)) return;
    const result = await submitApproval.mutateAsync({
      designId: pendingItem!.designId,
      taskId: pendingItem!.task?.id,
      approvalLevelId: pendingItem!.currentLevel.id,
      decision: formState.decision,
      remark: formState.remark.trim() || undefined,
      correctionType:
        formState.decision === "CORRECTION_REQUIRED" ? formState.correctionType : undefined,
      routeSubProcessCode:
        formState.decision === "CORRECTION_REQUIRED" ? formState.routeSubProcessCode : undefined,
      responsibleEmployeeId:
        formState.decision === "CORRECTION_REQUIRED" && formState.responsibleEmployeeId
          ? Number(formState.responsibleEmployeeId)
          : undefined,
    });
    setFormState(defaultApprovalDecisionFormState());
    if (result.nextLevel && !result.chainComplete) {
      await pendingQuery.refetch();
      return;
    }
    setModalOpen(false);
  }

  return (
    <>
      <div className="compact-design-actions mb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">Your sign-off</p>
          <p className="text-xs text-muted-foreground">
            {ideaRef} · {pendingItem.currentLevel.name}
          </p>
        </div>
        <div className="compact-design-actions-row">
          <AppButtonLink
            href={`${ROUTES.quality.approvals}?tab=management`}
            appVariant="ghost"
            size="sm"
          >
            All sign-offs
          </AppButtonLink>
          <AppButton type="button" size="sm" onClick={() => setModalOpen(true)}>
            Review &amp; approve
          </AppButton>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={`Decide ${ideaRef}`}
        size="lg"
        onClose={() => setModalOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={
                submitApproval.isPending ||
                !isApprovalDecisionFormValid(formState, pendingItem.costingReady)
              }
              onClick={() => void handleSubmit()}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ApprovalDecisionForm
          designId={designId}
          requestPackage={requestPackage}
          costingReady={pendingItem.costingReady}
          decisionOptions={[
            ...(pendingItem.costingReady
              ? [{ value: "APPROVED" as const, label: "Approve" }]
              : []),
            { value: "REJECTED", label: "Reject" },
            { value: "CORRECTION_REQUIRED", label: "Send for Correction" },
          ]}
          state={formState}
          onChange={setFormState}
          stageAssignees={pendingItem.stageAssignees}
          employeeOptions={(employeesQuery.data ?? []).map((e) => ({
            id: e.id,
            name: e.name,
          }))}
          nextLevelName={pendingItem.nextLevelName}
        />
      </Modal>
    </>
  );
}
