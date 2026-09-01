"use client";

import { useMemo, useState } from "react";
import { Modal, ModalFooterActions, ModalForm } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { Button } from "@/components/ui/button";
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
      title="Return for clarification"
      description={
        ideaRef
          ? `${ideaRef} — route a correction without changing completed history.`
          : "Route a correction without changing completed history."
      }
      size="lg"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || returnMutation.isPending}
            onClick={() => void handleSubmit()}
          >
            {returnMutation.isPending ? "Returning…" : "Return to design team"}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        {optionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading return options…</p>
        ) : !options?.canReturn ? (
          <p className="text-sm text-muted-foreground">
            This design cannot be returned right now. Handoff must be complete and release must not
            be finished.
          </p>
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
              placeholder="Select reason…"
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
              placeholder="Select stage…"
            />

            <FormTextArea
              id="returnRemark"
              label="Details for Design Head / stage owner"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="What needs to be clarified or corrected?"
              rows={4}
            />
          </>
        )}
      </ModalForm>
    </Modal>
  );
}
