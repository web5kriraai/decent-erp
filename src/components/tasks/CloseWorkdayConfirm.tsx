"use client";

import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";

type CloseWorkdayConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
};

export function CloseWorkdayConfirm({
  open,
  onClose,
  onConfirm,
  isPending = false,
}: CloseWorkdayConfirmProps) {
  return (
    <Modal
      open={open}
      title="Close workday?"
      description="This locks today's time for your account. You can still view tasks, but timers stay closed until the next workday."
      onClose={() => {
        if (!isPending) onClose();
      }}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton
            type="button"
            appVariant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </AppButton>
          <AppButton type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Closing…" : "Close Workday"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <p className="m-0 text-sm text-muted-foreground">
          Make sure no task timer is running before you continue.
        </p>
      </ModalForm>
    </Modal>
  );
}
