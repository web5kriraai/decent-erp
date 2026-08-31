"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type FormSelectProps = {
  id?: string;
  label?: string;
  required?: boolean;
  value: string | null;
  onValueChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  hint?: string;
};

/**
 * Labeled select that maps Base UI values → display labels via `items`.
 * Without `items`, SelectValue shows the raw value (e.g. "7" instead of "Meeting").
 */
export function FormSelect({
  id,
  label,
  required,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  triggerClassName,
  hint,
}: FormSelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={(next) => {
          if (next != null) onValueChange(String(next));
        }}
        items={items}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" className="min-w-[var(--anchor-width)]">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.description ? (
                <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                  <span className="truncate font-medium">{opt.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{opt.description}</span>
                </span>
              ) : (
                opt.label
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
