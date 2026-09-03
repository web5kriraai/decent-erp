"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { useRequestDesignApproval } from "@/hooks/use-approvals";
import { ApiClientError } from "@/lib/api-client";

const MIN_REMARK = 8;

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
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setRequesterRemark("");
      setSummaryNote("");
      setTouched(false);
      requestApproval.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on close
  }, [open]);

  const trimmed = requesterRemark.trim();
  const remarkTooShort = trimmed.length > 0 && trimmed.length < MIN_REMARK;
  const remarkMissing = touched && trimmed.length < MIN_REMARK;
  const canSubmit = trimmed.length >= MIN_REMARK && !requestApproval.isPending;
  const apiError =
    requestApproval.isError && requestApproval.error instanceof ApiClientError
      ? requestApproval.error.message
      : requestApproval.isError
        ? "Could not request approval"
        : undefined;

  async function handleSubmit() {
    setTouched(true);
    if (trimmed.length < MIN_REMARK) return;
    try {
      await requestApproval.mutateAsync({
        designId,
        requesterRemark: trimmed,
        summaryNote: summaryNote.trim() || undefined,
      });
      setRequesterRemark("");
      setSummaryNote("");
      setTouched(false);
      onSuccess?.();
      onClose();
    } catch {
      // Toast + inline apiError
    }
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
            disabled={!canSubmit}
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
          onBlur={() => setTouched(true)}
          placeholder="Summarize readiness for management — what was completed, open risks, and why sign-off is appropriate…"
          hint={`At least ${MIN_REMARK} characters required (${trimmed.length}/${MIN_REMARK}).`}
          error={
            remarkMissing || remarkTooShort
              ? `Enter at least ${MIN_REMARK} characters (e.g. “Ready for management review”). “Yes” alone is not enough.`
              : apiError
          }
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

