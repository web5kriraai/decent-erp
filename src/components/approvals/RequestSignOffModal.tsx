"use client";

import { useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { useRequestDesignApproval } from "@/hooks/use-approvals";

type RequestSignOffModalProps = {
  open: boolean;
  designId: string;
  ideaRef?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function RequestSignOffModal({
  open,
  designId,
  ideaRef,
  onClose,
  onSuccess,
}: RequestSignOffModalProps) {
  const requestApproval = useRequestDesignApproval();
  const [requesterRemark, setRequesterRemark] = useState("");
  const [summaryNote, setSummaryNote] = useState("");

  async function handleSubmit() {
    if (requesterRemark.trim().length < 8) return;
    await requestApproval.mutateAsync({
      designId,
      requesterRemark: requesterRemark.trim(),
      summaryNote: summaryNote.trim() || undefined,
    });
    setRequesterRemark("");
    setSummaryNote("");
    onSuccess?.();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Request Management Sign-off"
      description={
        ideaRef
          ? `Submit ${ideaRef} to the management approval chain. Approvers will see your remark and a design snapshot.`
          : "Submit this design to the management approval chain with a requester remark."
      }
      onClose={onClose}
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            disabled={requestApproval.isPending || requesterRemark.trim().length < 8}
            onClick={() => void handleSubmit()}
          >
            {requestApproval.isPending ? "Submitting…" : "Request Sign-off"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <FormTextArea
          id="requesterRemark"
          label="Requester remark"
          required
          rows={4}
          value={requesterRemark}
          onChange={(e) => setRequesterRemark(e.target.value)}
          placeholder="Summarize readiness for management — what was completed, open risks, and why sign-off is appropriate…"
        />
        <FormTextArea
          id="summaryNote"
          label="Optional summary note"
          rows={2}
          value={summaryNote}
          onChange={(e) => setSummaryNote(e.target.value)}
          placeholder="Extra context for approvers (optional)"
        />
      </ModalForm>
    </Modal>
  );
}
