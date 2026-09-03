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
import type { HoldReason } from "@/lib/types/api";

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
  preferredHoldReasonCodes = [],
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

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </AppButton>
          <AppButton type="button" disabled={!holdReasonId || isPending} onClick={onSubmit}>
            {isPending ? "Holding…" : "Confirm Hold"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <FormSelect
          id="holdReason"
          label="Hold Reason"
          required
          value={holdReasonId === "" ? null : String(holdReasonId)}
          onValueChange={(v) => onHoldReasonChange(v ? Number(v) : "")}
          options={options}
          placeholder="Select…"
          disabled={isPending || options.length === 0}
          error={options.length === 0 ? "No hold reasons configured" : undefined}
        />

        <FormTextArea
          id="holdRemark"
          label="Remark"
          rows={3}
          value={holdRemark}
          onChange={(e) => onHoldRemarkChange(e.target.value)}
          disabled={isPending}
        />
      </ModalForm>
    </Modal>
  );
}
