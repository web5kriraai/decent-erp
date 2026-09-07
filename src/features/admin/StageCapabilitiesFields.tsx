"use client";

import { FormSelect } from "@/components/ui/form-select";
import type { StageCapabilities } from "@/lib/workflow/stage-capabilities";

export type CapabilitiesFormState = {
  isApproval: boolean;
  requiresFile: boolean;
  isCorrectionAllowed: boolean;
  forcesChecking: boolean;
  machineOutput: boolean;
  sampleDecisionOutcomes: boolean;
  costingEntry: boolean;
  completeNotChecking: boolean;
  unlockAfterDesignApproved: boolean;
  autoAdvanceOnCreate: boolean;
  approvalSurface: StageCapabilities["approvalSurface"];
};

export const DEFAULT_CAPABILITIES_FORM: CapabilitiesFormState = {
  isApproval: false,
  requiresFile: false,
  isCorrectionAllowed: true,
  forcesChecking: false,
  machineOutput: false,
  sampleDecisionOutcomes: false,
  costingEntry: false,
  completeNotChecking: false,
  unlockAfterDesignApproved: false,
  autoAdvanceOnCreate: false,
  approvalSurface: "none",
};

export function capabilitiesFormToPayload(form: CapabilitiesFormState) {
  return {
    isApproval: form.isApproval,
    isFileRequired: form.requiresFile,
    isCorrectionAllowed: form.isCorrectionAllowed,
    capabilities: {
      isApproval: form.isApproval,
      requiresFile: form.requiresFile,
      isCorrectionAllowed: form.isCorrectionAllowed,
      forcesChecking: form.forcesChecking,
      machineOutput: form.machineOutput,
      sampleDecisionOutcomes: form.sampleDecisionOutcomes,
      costingEntry: form.costingEntry,
      completeNotChecking: form.completeNotChecking,
      unlockAfterDesignApproved: form.unlockAfterDesignApproved,
      autoAdvanceOnCreate: form.autoAdvanceOnCreate,
      approvalSurface: form.isApproval ? form.approvalSurface : "none",
      approvalActions: form.isApproval
        ? form.sampleDecisionOutcomes
          ? (["approve", "reject", "resample"] as const)
          : (["approve", "correction", "reject"] as const)
        : [],
      onComplete: [
        ...(form.sampleDecisionOutcomes ? (["sampleDecision"] as const) : []),
        ...(form.costingEntry ? (["costingPersist"] as const) : []),
        ...(form.completeNotChecking && form.unlockAfterDesignApproved
          ? (["unlockErp"] as const)
          : []),
      ],
    },
  };
}

function CapToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function StageCapabilitiesFields({
  value,
  onChange,
  idPrefix,
}: {
  value: CapabilitiesFormState;
  onChange: (next: CapabilitiesFormState) => void;
  idPrefix: string;
}) {
  function set<K extends keyof CapabilitiesFormState>(key: K, v: CapabilitiesFormState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">Stage options</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <CapToggle
          id={`${idPrefix}-approval`}
          label="Approval gate"
          checked={value.isApproval}
          onChange={(v) =>
            onChange({
              ...value,
              isApproval: v,
              approvalSurface: v
                ? value.approvalSurface === "none"
                  ? "inline_card"
                  : value.approvalSurface
                : "none",
            })
          }
        />
        <CapToggle
          id={`${idPrefix}-file`}
          label="Requires file"
          checked={value.requiresFile}
          onChange={(v) => set("requiresFile", v)}
        />
        <CapToggle
          id={`${idPrefix}-correction`}
          label="Allow corrections"
          checked={value.isCorrectionAllowed}
          onChange={(v) => set("isCorrectionAllowed", v)}
        />
        <CapToggle
          id={`${idPrefix}-checking`}
          label="Requires checking"
          checked={value.forcesChecking}
          onChange={(v) => set("forcesChecking", v)}
        />
        <CapToggle
          id={`${idPrefix}-machine`}
          label="Machine output"
          checked={value.machineOutput}
          onChange={(v) => set("machineOutput", v)}
        />
        <CapToggle
          id={`${idPrefix}-sample`}
          label="Sample decisions"
          checked={value.sampleDecisionOutcomes}
          onChange={(v) => set("sampleDecisionOutcomes", v)}
        />
        <CapToggle
          id={`${idPrefix}-costing`}
          label="Costing"
          checked={value.costingEntry}
          onChange={(v) => set("costingEntry", v)}
        />
        <CapToggle
          id={`${idPrefix}-complete`}
          label="Complete without checking"
          checked={value.completeNotChecking}
          onChange={(v) => set("completeNotChecking", v)}
        />
        <CapToggle
          id={`${idPrefix}-ladder`}
          label="Steps after approval"
          checked={value.unlockAfterDesignApproved}
          onChange={(v) => set("unlockAfterDesignApproved", v)}
        />
        <CapToggle
          id={`${idPrefix}-auto`}
          label="Start automatically"
          checked={value.autoAdvanceOnCreate}
          onChange={(v) => set("autoAdvanceOnCreate", v)}
        />
      </div>
      {value.isApproval ? (
        <FormSelect
          id={`${idPrefix}-surface`}
          label="Where to approve"
          value={value.approvalSurface === "none" ? "inline_card" : value.approvalSurface}
          onValueChange={(v) =>
            set("approvalSurface", (v as CapabilitiesFormState["approvalSurface"]) || "inline_card")
          }
          options={[
            { value: "inline_card", label: "Design detail" },
            { value: "task_panel", label: "Task panel" },
            { value: "task_end_dialog", label: "End of task" },
          ]}
        />
      ) : null}
    </div>
  );
}
