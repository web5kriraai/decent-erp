"use client";

import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import type { ReleasedDesignForGoLive } from "@/hooks/use-production";

type MarkLiveConfirmProps = {
  open: boolean;
  design: ReleasedDesignForGoLive | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function MarkLiveConfirm({
  open,
  design,
  onClose,
  onConfirm,
  isPending,
}: MarkLiveConfirmProps) {
  if (!design) return null;

  return (
    <Modal
      open={open}
      title={`Mark Live · ${design.ideaRef}`}
      onClose={onClose}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </AppButton>
          <AppButton type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Marking…" : "Confirm Mark Live"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ActionHandoffBanner
          context={{
            ideaRef: design.ideaRef,
            collectionName: design.collectionName,
            productType: design.productType?.name,
            stageName: "Live",
            status: design.status,
            description: design.liveReviewCompleted
              ? "Live review complete."
              : "Complete live review first.",
          }}
        />
      </ModalForm>
    </Modal>
  );
}
