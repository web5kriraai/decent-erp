"use client";

import { useEffect, useRef } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { useDesignHeadEmployees } from "@/hooks/use-masters";

type DesignHeadSelectFieldProps = {
  id: string;
  value: number | "";
  onChange: (value: number | "") => void;
  /** When set and value is empty, prefer this employee if they are a Design Head. */
  preferEmployeeId?: number | null;
  preferRoleCode?: string | null;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  enabled?: boolean;
  hint?: string;
};

/**
 * Picker for which Design Head owns the full concept → production workflow.
 * Defaults to session Design Head (when applicable) or the sole Design Head.
 */
export function DesignHeadSelectField({
  id,
  value,
  onChange,
  preferEmployeeId,
  preferRoleCode,
  error,
  required = true,
  disabled,
  enabled = true,
  hint = "Owns sign-off queue, KPI portfolio, and first workflow assignment for this concept.",
}: DesignHeadSelectFieldProps) {
  const heads = useDesignHeadEmployees(enabled);
  const appliedDefault = useRef(false);
  const options = (heads.data ?? []).map((h) => ({
    value: String(h.id),
    label: `${h.name} (${h.employeeCode})`,
  }));

  useEffect(() => {
    if (!enabled || appliedDefault.current || value !== "" || !heads.data?.length) return;
    if (preferRoleCode === "DESIGN_HEAD" && preferEmployeeId) {
      const self = heads.data.find((h) => h.id === preferEmployeeId);
      if (self) {
        appliedDefault.current = true;
        onChange(self.id);
        return;
      }
    }
    if (heads.data.length === 1) {
      appliedDefault.current = true;
      onChange(heads.data[0].id);
    }
  }, [enabled, value, heads.data, preferEmployeeId, preferRoleCode, onChange]);

  return (
    <FormSelect
      id={id}
      label="Design Head"
      required={required}
      value={value === "" ? null : String(value)}
      onValueChange={(v) => onChange(v ? Number(v) : "")}
      options={options}
      placeholder={heads.isLoading ? "Loading…" : "Select Design Head…"}
      error={error}
      disabled={disabled || heads.isLoading}
      hint={hint}
    />
  );
}
