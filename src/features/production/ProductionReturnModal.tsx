"use client";

import { useMemo, useState } from "react";
import { Modal, ModalFooterActions, ModalForm } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import {
  useProductionReturn,
  useProductionReturnOptions,
} from "@/hooks/use-production";
import { suggestedRouteCodeForReason } from "@/lib/production-return-reasons";

type ProductionReturnModalProps = {
  open: boolean;
  designId: string;
  ideaRef?: string;
  onClose: () => void;
};

export function ProductionReturnModal({
  open,
  designId,
  ideaRef,
  onClose,
}: ProductionReturnModalProps) {
  const optionsQuery = useProductionReturnOptions(designId, open);
  const returnMutation = useProductionReturn();

  const [reasonCode, setReasonCode] = useState("");
  const [routeToSubProcessId, setRouteToSubProcessId] = useState("");
  const [remark, setRemark] = useState("");

  const options = optionsQuery.data;
  const routeOptions = useMemo(() => options?.routeOptions ?? [], [options?.routeOptions]);

  function handleClose() {
    setReasonCode("");
    setRouteToSubProcessId("");
    setRemark("");
    onClose();
  }

  function handleReasonChange(code: string) {
    setReasonCode(code);
    const suggested = suggestedRouteCodeForReason(code);
    const match = routeOptions.find((r) => r.code === suggested);
    setRouteToSubProcessId(match ? String(match.id) : "");
  }

  const canSubmit = useMemo(
    () => reasonCode && routeToSubProcessId && options?.canReturn,
    [reasonCode, routeToSubProcessId, options?.canReturn],
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    await returnMutation.mutateAsync({
      designId,
      reasonCode,
      routeToSubProcessId: Number(routeToSubProcessId),
      remark: remark.trim() || undefined,
    });
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={ideaRef ? `Return · ${ideaRef}` : "Return for clarification"}
      size="md"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="danger"
            disabled={!canSubmit || returnMutation.isPending}
            onClick={() => void handleSubmit()}
          >
            {returnMutation.isPending ? "Returning…" : "Return to design team"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        {optionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !options?.canReturn ? (
          <p className="text-sm text-muted-foreground">Return unavailable</p>
        ) : (
          <>
            <FormSelect
              id="returnReason"
              label="Reason"
              required
              value={reasonCode || null}
              onValueChange={handleReasonChange}
              options={options.reasons.map((reason) => ({
                value: reason.code,
                label: reason.label,
              }))}
              placeholder="Select…"
            />

            <FormSelect
              id="returnRoute"
              label="Route correction to"
              required
              value={routeToSubProcessId || null}
              onValueChange={setRouteToSubProcessId}
              options={routeOptions.map((route) => ({
                value: String(route.id),
                label: route.name,
              }))}
              placeholder="Select…"
            />

            <FormTextArea
              id="returnRemark"
              label="Details"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
            />
          </>
        )}
      </ModalForm>
    </Modal>
  );
}
