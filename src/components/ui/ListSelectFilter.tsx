"use client";

import { ListFilterField } from "@/components/ui/ListFilterField";
import { cn } from "@/lib/utils";

export type ListSelectOption = {
  value: string;
  label: string;
};

export type ListSelectFilterProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ListSelectOption[];
  className?: string;
  /** Show label inline (default) or screen-reader only. */
  labelHidden?: boolean;
};

/** Compact native select for list toolbars (status, entity type, etc.). */
export function ListSelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  className,
  labelHidden = false,
}: ListSelectFilterProps) {
  return (
    <ListFilterField
      id={id}
      label={label}
      labelHidden={labelHidden}
      className={cn("list-select-filter", className)}
    >
      <select
        id={id}
        className="list-filter-control list-filter-control--select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.value || "__all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </ListFilterField>
  );
}
