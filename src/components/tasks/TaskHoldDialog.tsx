"use client";

import { useMemo } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import type { HoldReason } from "@/lib/types/api";
import type { HandoffContext } from "@/lib/handoff-context";

type TaskHoldDialogProps = {
  open: boolean;
  onClose: () => void;
  holdReasons: HoldReason[];
  holdReasonId: number | "";
  onHoldReasonChange: (id: number | "") => void;
  holdRemark: string;
  onHoldRemarkChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  title?: string;
  description?: string;
  preferredHoldReasonCodes?: string[];
  remarkLabel?: string;
  remarkPlaceholder?: string;
  handoff?: HandoffContext | null;
};

export function TaskHoldDialog({
  open,
  onClose,
  holdReasons,
  holdReasonId,
  onHoldReasonChange,
  holdRemark,
  onHoldRemarkChange,
  onSubmit,
  isPending,
  title = "Hold Task",
  description,
  preferredHoldReasonCodes = [],
  remarkLabel = "Hold note",
  remarkPlaceholder = "Optional — what are you waiting on?",
  handoff,
}: TaskHoldDialogProps) {
  const orderedReasons = useMemo(() => {
    if (preferredHoldReasonCodes.length === 0) return holdReasons;
    const rank = new Map(preferredHoldReasonCodes.map((code, index) => [code, index]));
    return [...holdReasons].sort((a, b) => {
      const ra = rank.has(a.code) ? rank.get(a.code)! : 999;
      const rb = rank.has(b.code) ? rank.get(b.code)! : 999;
      return ra - rb;
    });
  }, [holdReasons, preferredHoldReasonCodes]);

  const options = orderedReasons.map((r) => ({
    value: String(r.id),
    label: r.name,
  }));

  const canSubmit = !!holdReasonId && !isPending;

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </AppButton>
          <AppButton type="button" disabled={!canSubmit} onClick={onSubmit}>
            {isPending ? "Holding…" : "Confirm Hold"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ActionHandoffBanner context={handoff} />
        <FormSelect
          id="holdReason"
          label="Hold Reason"
          required
          value={holdReasonId === "" ? null : String(holdReasonId)}
          onValueChange={(v) => onHoldReasonChange(v ? Number(v) : "")}
          options={options}
          placeholder="Select why you are pausing…"
          disabled={isPending || options.length === 0}
          error={options.length === 0 ? "No hold reasons configured" : undefined}
        />

        <FormTextArea
          id="holdRemark"
          label={remarkLabel}
          rows={3}
          value={holdRemark}
          onChange={(e) => onHoldRemarkChange(e.target.value)}
          placeholder={remarkPlaceholder}
          disabled={isPending}
          onEnterSubmit={canSubmit ? onSubmit : undefined}
        />
      </ModalForm>
    </Modal>
  );
}
