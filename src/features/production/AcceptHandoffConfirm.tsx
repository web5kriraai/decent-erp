"use client";

import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import type { ProductionInboxDesign } from "@/lib/services/production-inbox-service";

type AcceptHandoffConfirmProps = {
  open: boolean;
  item: ProductionInboxDesign | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function AcceptHandoffConfirm({
  open,
  item,
  onClose,
  onConfirm,
  isPending,
}: AcceptHandoffConfirmProps) {
  if (!item) return null;

  return (
    <Modal
      open={open}
      title={`Accept handoff · ${item.ideaRef}`}
      onClose={() => {
        if (!isPending) onClose();
      }}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton
            type="button"
            appVariant="outline"
            onClick={() => {
              if (!isPending) onClose();
            }}
            disabled={isPending}
          >
            Cancel
          </AppButton>
          <AppButton type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Accepting…" : "Accept handoff"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ActionHandoffBanner
          context={{
            ideaRef: item.ideaRef,
            collectionName: item.collectionName,
            productType: item.productType,
            stageName: item.stageLabel,
            status: item.status,
            nextStepHint: "Production Instruction",
          }}
        />
      </ModalForm>
    </Modal>
  );
}
