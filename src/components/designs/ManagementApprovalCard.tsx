"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Modal,
  ModalFooterActions,
} from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
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
      <AppCard
        title="Your sign-off"
        description={`${ideaRef} · ${pendingItem.currentLevel.name}`}
        className="mb-4 border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
      >
        <div className="flex flex-wrap items-center gap-3">
          <AppButton type="button" size="sm" onClick={() => setModalOpen(true)}>
            Review &amp; approve
          </AppButton>
          <Link
            href={`${ROUTES.quality.approvals}?tab=management`}
            className="text-sm font-medium text-primary hover:underline"
          >
            All sign-offs
          </Link>
        </div>
      </AppCard>

      <Modal
        open={modalOpen}
        title={`Decide ${ideaRef}`}
        description={`Review the package, then submit your decision for ${pendingItem.currentLevel.name}.`}
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
