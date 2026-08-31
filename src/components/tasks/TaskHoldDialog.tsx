"use client";

import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!holdReasonId || isPending}
            onClick={onSubmit}
          >
            {isPending ? "Holding…" : "Confirm Hold"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
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

        <div className="space-y-2">
          <Label htmlFor="holdRemark">Remark</Label>
          <Textarea
            id="holdRemark"
            rows={3}
            value={holdRemark}
            onChange={(e) => onHoldRemarkChange(e.target.value)}
            placeholder="Optional note for your team…"
            disabled={isPending}
            className="resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
