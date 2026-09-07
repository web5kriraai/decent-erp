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
      description="Confirm you are taking ownership for production instruction."
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
            nextStepHint: "Unlocks Production Instruction on your My Tasks",
            description: `Design Head: ${item.designHead}. Acceptance moves this design into the production ladder.`,
          }}
        />
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Confirm product / collection match floor capacity.</li>
          <li>You will complete Production Instruction next, then Release.</li>
        </ul>
      </ModalForm>
    </Modal>
  );
}
