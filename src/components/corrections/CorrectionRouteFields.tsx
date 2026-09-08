"use client";

import { useEffect, useMemo, useState } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { useDesign } from "@/hooks/use-designs";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import {
  correctionRouteCodesFromStages,
  suggestedCorrectionRouteCode,
} from "@/lib/workflow/correction-routes";

export type CorrectionRouteSelection = {
  routeToSubProcessId: number | "";
  reworkAssigneeEmployeeId: number | "";
  responsibleEmployeeId: number | "";
  correctionType: string;
};

const TYPE_OPTIONS = [
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "MISTAKE", label: "Mistake" },
  { value: "CUSTOMER_CHANGE", label: "Customer change" },
  { value: "MACHINE", label: "Machine" },
  { value: "MATERIAL", label: "Material" },
  { value: "OTHER", label: "Other" },
];

/** Shared stage + rework assignee + optional KPI blame fields for correction routing. */
export function CorrectionRouteFields({
  designId,
  sourceStageCode,
  enabled,
  value,
  onChange,
  disabled,
}: {
  designId: string;
  sourceStageCode?: string;
  enabled: boolean;
  value: CorrectionRouteSelection;
  onChange: (next: CorrectionRouteSelection) => void;
  disabled?: boolean;
}) {
  const designQuery = useDesign(designId, enabled && !!designId);
  const employeesQuery = useEmployeeOptions(enabled);
  const [seeded, setSeeded] = useState(false);

  const routeOptions = useMemo(() => {
    const tasks = designQuery.data?.tasks ?? [];
    const stages = tasks.map((t) => ({
      code: t.subProcess.code,
      name: t.subProcess.name,
      isCorrectionAllowed: (t.subProcess as { isCorrectionAllowed?: boolean })
        .isCorrectionAllowed,
      capabilities: (t.subProcess as { capabilities?: unknown }).capabilities,
      status: t.status,
    }));
    const codes = correctionRouteCodesFromStages(stages);
    const byCode = new Map<string, { id: number; name: string; code: string }>();
    for (const t of tasks) {
      if (!codes.includes(t.subProcess.code)) continue;
      if (!byCode.has(t.subProcess.code)) {
        byCode.set(t.subProcess.code, {
          id: t.subProcess.id,
          name: t.subProcess.name,
          code: t.subProcess.code,
        });
      }
    }
    return codes
      .map((c) => byCode.get(c))
      .filter((r): r is { id: number; name: string; code: string } => !!r);
  }, [designQuery.data?.tasks]);

  useEffect(() => {
    if (!enabled) {
      setSeeded(false);
      return;
    }
    if (seeded || routeOptions.length === 0) return;
    const suggested = suggestedCorrectionRouteCode(
      sourceStageCode,
      routeOptions.map((r) => r.code),
    );
    const match =
      routeOptions.find((r) => r.code === suggested) ??
      routeOptions.find((r) => r.code === "MACHINE_SAMPLE") ??
      routeOptions[0];
    const stageTask = (designQuery.data?.tasks ?? []).find(
      (t) => t.subProcess.id === match.id,
    );
    onChange({
      ...value,
      routeToSubProcessId: match.id,
      reworkAssigneeEmployeeId:
        value.reworkAssigneeEmployeeId ||
        stageTask?.assignedEmployee?.id ||
        "",
    });
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, routeOptions, sourceStageCode, seeded]);

  if (!enabled) return null;

  const isMistake = value.correctionType === "MISTAKE";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <p className="m-0 text-xs font-semibold text-foreground">Correction routing</p>
      <FormSelect
        id="shared-corr-route"
        label="Route rework to"
        required
        value={value.routeToSubProcessId === "" ? null : String(value.routeToSubProcessId)}
        onValueChange={(v) => {
          const id = v ? Number(v) : "";
          const stageTask = (designQuery.data?.tasks ?? []).find(
            (t) => t.subProcess.id === id,
          );
          onChange({
            ...value,
            routeToSubProcessId: id,
            reworkAssigneeEmployeeId: stageTask?.assignedEmployee?.id ?? "",
          });
        }}
        options={routeOptions.map((r) => ({ value: String(r.id), label: r.name }))}
        placeholder="Select stage…"
        disabled={disabled || routeOptions.length === 0}
      />
      <FormSelect
        id="shared-corr-rework"
        label="Rework assignee"
        required
        value={
          value.reworkAssigneeEmployeeId === ""
            ? null
            : String(value.reworkAssigneeEmployeeId)
        }
        onValueChange={(v) =>
          onChange({ ...value, reworkAssigneeEmployeeId: v ? Number(v) : "" })
        }
        options={(employeesQuery.data ?? []).map((e) => ({
          value: String(e.id),
          label: e.name,
        }))}
        placeholder="Who does the rework…"
        disabled={disabled}
      />
      <FormSelect
        id="shared-corr-type"
        label="Correction type"
        required
        value={value.correctionType}
        onValueChange={(v) =>
          onChange({
            ...value,
            correctionType: v,
            responsibleEmployeeId: v === "MISTAKE" ? value.responsibleEmployeeId : "",
          })
        }
        options={TYPE_OPTIONS}
        disabled={disabled}
      />
      {isMistake ? (
        <FormSelect
          id="shared-corr-blame"
          label="Responsible (KPI blame)"
          required
          value={
            value.responsibleEmployeeId === ""
              ? null
              : String(value.responsibleEmployeeId)
          }
          onValueChange={(v) =>
            onChange({ ...value, responsibleEmployeeId: v ? Number(v) : "" })
          }
          options={(employeesQuery.data ?? []).map((e) => ({
            value: String(e.id),
            label: e.name,
          }))}
          placeholder="Select…"
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

export function emptyCorrectionRouteSelection(): CorrectionRouteSelection {
  return {
    routeToSubProcessId: "",
    reworkAssigneeEmployeeId: "",
    responsibleEmployeeId: "",
    correctionType: "IMPROVEMENT",
  };
}

export function isCorrectionRouteSelectionValid(value: CorrectionRouteSelection): boolean {
  if (!value.routeToSubProcessId || !value.reworkAssigneeEmployeeId) return false;
  if (value.correctionType === "MISTAKE" && !value.responsibleEmployeeId) return false;
  return true;
}

export function correctionRouteApiPayload(value: CorrectionRouteSelection) {
  return {
    correctionRouteToSubProcessId: Number(value.routeToSubProcessId),
    correctionReworkAssigneeEmployeeId: Number(value.reworkAssigneeEmployeeId),
    correctionResponsibleEmployeeId:
      value.correctionType === "MISTAKE" && value.responsibleEmployeeId
        ? Number(value.responsibleEmployeeId)
        : null,
    correctionType: value.correctionType,
  };
}
