"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ROUTES } from "@/config/routes";
import { usePendingApprovals, useSubmitApproval } from "@/hooks/use-approvals";
import { getManagementLevelOwnerRole } from "@/lib/approval-hub-rbac";
import { getRoleDefinition } from "@/config/roles";

type ManagementApprovalCardProps = {
  designId: string;
  ideaRef: string;
};

export function ManagementApprovalCard({ designId, ideaRef }: ManagementApprovalCardProps) {
  const pendingQuery = usePendingApprovals(true);
  const submitApproval = useSubmitApproval();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">(
    "APPROVED",
  );
  const [remark, setRemark] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const pendingItem = (pendingQuery.data ?? []).find((item) => item.designId === designId);
  if (!pendingItem) return null;

  const levelCode = pendingItem.currentLevel.code ?? "";
  const ownerRole = getManagementLevelOwnerRole(levelCode);
  const ownerLabel = ownerRole
    ? (getRoleDefinition(ownerRole)?.displayName ?? ownerRole)
    : "Approver";

  async function handleSubmit() {
    if (decision !== "APPROVED" && !remark.trim()) return;
    if (decision === "APPROVED" && pendingItem!.costingReady === false) return;
    const result = await submitApproval.mutateAsync({
      designId: pendingItem!.designId,
      taskId: pendingItem!.task?.id,
      approvalLevelId: pendingItem!.currentLevel.id,
      decision,
      remark: remark.trim() || undefined,
    });
    setRemark("");
    setDecision("APPROVED");
    if (result.nextLevel && !result.chainComplete) {
      await pendingQuery.refetch();
      return;
    }
    setModalOpen(false);
  }

  return (
    <>
      <AppCard
        title="Management sign-off — your action"
        description={`${ideaRef} is waiting for your decision at ${pendingItem.currentLevel.name}.`}
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
            Open all management sign-offs
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Current level: {pendingItem.currentLevel.name} ({ownerLabel})
        </p>
      </AppCard>

      <Modal
        open={modalOpen}
        title={`Approve ${ideaRef}`}
        description={`Submit your decision for ${pendingItem.currentLevel.name}.`}
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
                (decision !== "APPROVED" && !remark.trim()) ||
                (decision === "APPROVED" && pendingItem.costingReady === false)
              }
              onClick={handleSubmit}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          {pendingItem.costingReady === false && decision === "APPROVED" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
              Final management approval needs costing first. Add at least one cost entry on{" "}
              <Link href={ROUTES.finance.costing} className="font-medium underline">
                Finance → Costing
              </Link>
              , then return here to approve.
            </p>
          ) : null}
          <FormSelect
            id="managementApprovalDecision"
            label="Decision"
            required
            value={decision}
            onValueChange={(v) => setDecision(v as typeof decision)}
            options={[
              { value: "APPROVED", label: "Approve" },
              { value: "REJECTED", label: "Reject" },
              { value: "CORRECTION_REQUIRED", label: "Send for Correction" },
            ]}
          />
          <FormTextArea
            id="managementApprovalRemark"
            label="Remark"
            rows={3}
            required={decision !== "APPROVED"}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={
              decision === "APPROVED"
                ? "Optional notes for the design team…"
                : "Required — explain why this was rejected or sent back…"
            }
          />
        </ModalForm>
      </Modal>
    </>
  );
}
