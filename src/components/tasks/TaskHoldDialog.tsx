"use client";

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
}: TaskHoldDialogProps) {
  const options = holdReasons.map((r) => ({
    value: String(r.id),
    label: r.name,
    description: r.code.replace(/_/g, " "),
  }));

  return (
    <Modal
      open={open}
      title="Hold Task"
      description="Active work time pauses until you resume. Choose why you are putting this task on hold."
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
          placeholder="Select a reason…"
          disabled={isPending || options.length === 0}
          hint={
            options.length === 0
              ? "No hold reasons are configured. Ask an admin to add them in Masters."
              : undefined
          }
        />

        <FormTextArea
          id="holdRemark"
          label="Remark"
          rows={3}
          value={holdRemark}
          onChange={(e) => onHoldRemarkChange(e.target.value)}
          placeholder="Optional note for your team…"
          disabled={isPending}
        />
      </ModalForm>
    </Modal>
  );
}
