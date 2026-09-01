"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
import { Button } from "@/components/ui/button";
import { useDesignsList } from "@/hooks/use-designs";
import { useDesign } from "@/hooks/use-designs";
import { useEmployeeOptions, useRaiseCorrection } from "@/hooks/use-corrections";
import { useProcessMasters } from "@/hooks/use-masters";
import type { RaiseCorrectionPayload } from "@/hooks/use-corrections";

type RaiseCorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  defaultDesignId?: string;
  defaultTaskId?: string;
};

const CORRECTION_TYPE_OPTIONS: {
  value: RaiseCorrectionPayload["correctionType"];
  label: string;
}[] = [
  { value: "MISTAKE", label: "Mistake" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "CUSTOMER_CHANGE", label: "Customer Change" },
  { value: "MACHINE", label: "Machine Issue" },
  { value: "MATERIAL", label: "Material Issue" },
  { value: "OTHER", label: "Other" },
];

export function RaiseCorrectionModal({
  open,
  onClose,
  defaultDesignId,
  defaultTaskId,
}: RaiseCorrectionModalProps) {
  const designsQuery = useDesignsList(open);
  const employeesQuery = useEmployeeOptions(open);
  const processesQuery = useProcessMasters(open);
  const raiseCorrection = useRaiseCorrection();

  const [designId, setDesignId] = useState(defaultDesignId ?? "");
  const [taskId, setTaskId] = useState("");
  const [correctionType, setCorrectionType] =
    useState<RaiseCorrectionPayload["correctionType"]>("MISTAKE");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<number | "">("");
  const [routeToSubProcessId, setRouteToSubProcessId] = useState<number | "">("");
  const [rootCause, setRootCause] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [extraCost, setExtraCost] = useState("");

  const designQuery = useDesign(designId, open && !!designId);
  const tasks = designQuery.data?.tasks ?? [];
  const isMistake = correctionType === "MISTAKE";

  const subProcessOptions =
    processesQuery.data?.flatMap((p) =>
      (p.subProcesses ?? []).map((sp) => ({
        id: sp.id,
        label: `${p.name} → ${sp.name}`,
      })),
    ) ?? [];

  useEffect(() => {
    if (open && defaultDesignId) setDesignId(defaultDesignId);
  }, [open, defaultDesignId]);

  useEffect(() => {
    if (open && defaultTaskId) {
      setTaskId(defaultTaskId);
      return;
    }
    if (!defaultDesignId) setTaskId("");
  }, [designId, defaultDesignId, defaultTaskId, open]);

  useEffect(() => {
    if (!isMistake) setResponsibleEmployeeId("");
  }, [isMistake]);

  async function handleSubmit() {
    if (!designId || !taskId) return;
    if (isMistake && !responsibleEmployeeId) return;
    await raiseCorrection.mutateAsync({
      designId,
      taskId,
      correctionType,
      responsibleEmployeeId: responsibleEmployeeId ? Number(responsibleEmployeeId) : null,
      routeToSubProcessId: routeToSubProcessId ? Number(routeToSubProcessId) : null,
      rootCause: rootCause.trim() || undefined,
      extraMinutes: extraMinutes ? Number(extraMinutes) : undefined,
      extraCost: extraCost ? Number(extraCost) : undefined,
    });
    onClose();
  }

  const canSubmit =
    !!designId &&
    !!taskId &&
    (!isMistake || !!responsibleEmployeeId) &&
    !raiseCorrection.isPending;

  return (
    <Modal
      open={open}
      title="Raise Correction"
      description="Record a correction against a design task and route it back through the workflow if needed."
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {raiseCorrection.isPending ? "Raising…" : "Raise Correction"}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <FormSelect
          id="corrDesign"
          label="Design"
          required
          value={designId || null}
          onValueChange={setDesignId}
          options={(designsQuery.data?.items ?? []).map((d) => ({
            value: d.id,
            label: `${d.ideaRef} - ${d.collectionName}`,
          }))}
          placeholder="Select design…"
        />

        <FormSelect
          id="corrTask"
          label="Task"
          required
          value={taskId || null}
          onValueChange={setTaskId}
          options={tasks.map((t) => ({
            value: t.id,
            label: `${t.process.name} → ${t.subProcess.name} (${t.status})`,
          }))}
          placeholder="Select task…"
          disabled={!designId || designQuery.isLoading}
        />

        <ModalFormGrid>
          <FormSelect
            id="corrType"
            label="Type"
            required
            value={correctionType}
            onValueChange={(v) =>
              setCorrectionType(v as RaiseCorrectionPayload["correctionType"])
            }
            options={CORRECTION_TYPE_OPTIONS}
          />
          <FormSelect
            id="corrResponsible"
            label="Responsible Employee"
            required={isMistake}
            value={responsibleEmployeeId === "" ? null : String(responsibleEmployeeId)}
            onValueChange={(v) =>
              setResponsibleEmployeeId(v ? Number(v) : "")
            }
            options={(employeesQuery.data ?? []).map((e) => ({
              value: String(e.id),
              label: `${e.name} (${e.employeeCode})`,
            }))}
            placeholder="Select employee…"
            hint={isMistake ? undefined : "Optional for non-mistake corrections"}
          />
        </ModalFormGrid>

        <FormSelect
          id="corrRoute"
          label="Route back to sub-process"
          value={routeToSubProcessId === "" ? null : String(routeToSubProcessId)}
          onValueChange={(v) => setRouteToSubProcessId(v ? Number(v) : "")}
          options={subProcessOptions.map((sp) => ({
            value: String(sp.id),
            label: sp.label,
          }))}
          placeholder="Same task (restore on close)"
        />

        <FormTextArea
          id="corrRootCause"
          label="Root Cause"
          rows={2}
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
        />

        <ModalFormGrid>
          <FormTextField
            id="corrMinutes"
            label="Extra Minutes"
            type="number"
            min={0}
            value={extraMinutes}
            onChange={(e) => setExtraMinutes(e.target.value)}
          />
          <FormTextField
            id="corrCost"
            label="Extra Cost"
            type="number"
            min={0}
            step="0.01"
            value={extraCost}
            onChange={(e) => setExtraCost(e.target.value)}
          />
        </ModalFormGrid>
      </ModalForm>
    </Modal>
  );
}
