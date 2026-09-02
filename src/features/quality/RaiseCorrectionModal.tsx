"use client";

import { useMemo, useState } from "react";
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

/** Preferred rework targets for the correction loop (spec: often back to Punching). */
const ROUTE_CODES = ["SKETCH", "PUNCH", "MACHINE_SAMPLE", "COSTING"] as const;

function suggestedRouteCode(sourceCode?: string | null): (typeof ROUTE_CODES)[number] {
  switch (sourceCode) {
    case "SKETCH_APPROVAL":
    case "SKETCH":
      return "SKETCH";
    case "SAMPLE_CHECK":
    case "MACHINE_SAMPLE":
      return "MACHINE_SAMPLE";
    case "PUNCH_CHECK":
    case "PUNCH":
    default:
      return "PUNCH";
  }
}

function buildInitialState(defaultDesignId?: string, defaultTaskId?: string) {
  return {
    designId: defaultDesignId ?? "",
    taskId: defaultTaskId ?? "",
    correctionType: "IMPROVEMENT" as RaiseCorrectionPayload["correctionType"],
    responsibleEmployeeId: "" as number | "",
    routeToSubProcessId: "" as number | "",
    rootCause: "",
    extraMinutes: "",
    extraCost: "",
  };
}

export function RaiseCorrectionModal({
  open,
  onClose,
  defaultDesignId,
  defaultTaskId,
}: RaiseCorrectionModalProps) {
  const isPrefilled = !!(defaultDesignId && defaultTaskId);
  const designsQuery = useDesignsList(open && !isPrefilled);
  const employeesQuery = useEmployeeOptions(open);
  const raiseCorrection = useRaiseCorrection();

  const openKey = open ? `${defaultDesignId ?? ""}:${defaultTaskId ?? ""}` : "closed";
  const [loadedKey, setLoadedKey] = useState("closed");
  const [designId, setDesignId] = useState(defaultDesignId ?? "");
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");
  const [correctionType, setCorrectionType] =
    useState<RaiseCorrectionPayload["correctionType"]>("IMPROVEMENT");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<number | "">("");
  const [routeToSubProcessId, setRouteToSubProcessId] = useState<number | "">("");
  const [rootCause, setRootCause] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [routeSeededFor, setRouteSeededFor] = useState("");

  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    const initial = buildInitialState(defaultDesignId, defaultTaskId);
    setDesignId(initial.designId);
    setTaskId(initial.taskId);
    setCorrectionType(initial.correctionType);
    setResponsibleEmployeeId(initial.responsibleEmployeeId);
    setRouteToSubProcessId(initial.routeToSubProcessId);
    setRootCause(initial.rootCause);
    setExtraMinutes(initial.extraMinutes);
    setExtraCost(initial.extraCost);
    setRouteSeededFor("");
  }

  const designQuery = useDesign(designId, open && !!designId);
  const isMistake = correctionType === "MISTAKE";

  const selectedTask = (designQuery.data?.tasks ?? []).find((t) => t.id === taskId);
  const routeOptions = useMemo(() => {
    const tasks = designQuery.data?.tasks ?? [];
    const byCode = new Map<string, { id: number; name: string; code: string }>();
    for (const t of tasks) {
      const code = t.subProcess.code;
      if (!(ROUTE_CODES as readonly string[]).includes(code)) continue;
      if (!byCode.has(code)) {
        byCode.set(code, { id: t.subProcess.id, name: t.subProcess.name, code });
      }
    }
    return ROUTE_CODES.map((code) => byCode.get(code)).filter(
      (r): r is { id: number; name: string; code: string } => !!r,
    );
  }, [designQuery.data?.tasks]);

  const routeSeedKey = `${designId}:${taskId}:${routeOptions.map((r) => r.id).join(",")}`;
  if (open && routeSeedKey !== routeSeededFor && routeOptions.length > 0 && taskId) {
    setRouteSeededFor(routeSeedKey);
    const suggested = suggestedRouteCode(selectedTask?.subProcess.code);
    const match = routeOptions.find((r) => r.code === suggested) ?? routeOptions[0];
    setRouteToSubProcessId(match.id);
  }

  function handleClose() {
    setLoadedKey("closed");
    onClose();
  }

  function handleCorrectionTypeChange(value: RaiseCorrectionPayload["correctionType"]) {
    setCorrectionType(value);
    if (value !== "MISTAKE") {
      setResponsibleEmployeeId("");
    }
  }

  async function handleSubmit() {
    if (!designId || !taskId || !rootCause.trim() || !routeToSubProcessId) return;
    if (isMistake && !responsibleEmployeeId) return;
    await raiseCorrection.mutateAsync({
      designId,
      taskId,
      correctionType,
      responsibleEmployeeId: responsibleEmployeeId ? Number(responsibleEmployeeId) : null,
      routeToSubProcessId: Number(routeToSubProcessId),
      rootCause: rootCause.trim(),
      extraMinutes: extraMinutes.trim() ? Number(extraMinutes) : null,
      extraCost: extraCost.trim() ? Number(extraCost) : null,
    });
    handleClose();
  }

  const canSubmit =
    !!designId &&
    !!taskId &&
    !!rootCause.trim() &&
    !!routeToSubProcessId &&
    (!isMistake || !!responsibleEmployeeId) &&
    !raiseCorrection.isPending;

  return (
    <Modal
      open={open}
      title="Raise Correction"
      description="Send work back to a stage (usually Punching) with a clear reason."
      onClose={handleClose}
      size="lg"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {raiseCorrection.isPending ? "Raising…" : "Raise Correction"}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        {!isPrefilled ? (
          <>
            <FormSelect
              id="corrDesign"
              label="Design"
              required
              value={designId || null}
              onValueChange={(v) => {
                setDesignId(v);
                setTaskId("");
                setRouteToSubProcessId("");
                setRouteSeededFor("");
              }}
              options={(designsQuery.data?.items ?? []).map((d) => ({
                value: d.id,
                label: `${d.ideaRef} - ${d.collectionName}`,
              }))}
              placeholder="Select design…"
            />

            <FormSelect
              id="corrTask"
              label="Source task"
              required
              value={taskId || null}
              onValueChange={(v) => {
                setTaskId(v);
                setRouteSeededFor("");
              }}
              options={(designQuery.data?.tasks ?? []).map((t) => ({
                value: t.id,
                label: `${t.process.name} → ${t.subProcess.name} (${t.status})`,
              }))}
              placeholder="Select task…"
              disabled={!designId || designQuery.isLoading}
            />
          </>
        ) : null}

        <FormSelect
          id="corrRoute"
          label="Route rework to"
          required
          value={routeToSubProcessId === "" ? null : String(routeToSubProcessId)}
          onValueChange={(v) => setRouteToSubProcessId(v ? Number(v) : "")}
          options={routeOptions.map((r) => ({
            value: String(r.id),
            label: r.name,
          }))}
          placeholder={designQuery.isLoading ? "Loading stages…" : "Select stage…"}
          disabled={!designId || routeOptions.length === 0}
          hint="Defaults to Punching when available — change if rework belongs elsewhere."
        />

        <ModalFormGrid>
          <FormSelect
            id="corrType"
            label="Type"
            required
            value={correctionType}
            onValueChange={(v) =>
              handleCorrectionTypeChange(v as RaiseCorrectionPayload["correctionType"])
            }
            options={CORRECTION_TYPE_OPTIONS}
          />
          <FormSelect
            id="corrResponsible"
            label="Responsible Employee"
            required={isMistake}
            value={responsibleEmployeeId === "" ? null : String(responsibleEmployeeId)}
            onValueChange={(v) => setResponsibleEmployeeId(v ? Number(v) : "")}
            options={(employeesQuery.data ?? []).map((e) => ({
              value: String(e.id),
              label: e.name,
            }))}
            placeholder="Select employee…"
            hint={isMistake ? undefined : "Optional for non-mistake corrections"}
          />
        </ModalFormGrid>

        <ModalFormGrid>
          <FormTextField
            id="corrExtraMinutes"
            label="Extra minutes"
            type="number"
            min={0}
            value={extraMinutes}
            onChange={(e) => setExtraMinutes(e.target.value)}
            placeholder="0"
            hint="Optional rework time impact"
          />
          <FormTextField
            id="corrExtraCost"
            label="Extra cost"
            type="number"
            min={0}
            step="0.01"
            value={extraCost}
            onChange={(e) => setExtraCost(e.target.value)}
            placeholder="0"
            hint="Optional rework cost impact"
          />
        </ModalFormGrid>

        <FormTextArea
          id="corrRootCause"
          label="Reason / feedback"
          required
          rows={3}
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="Describe what needs to be fixed…"
        />
      </ModalForm>
    </Modal>
  );
}
