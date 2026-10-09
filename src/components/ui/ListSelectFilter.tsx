"use client";

import { ListFilterField } from "@/components/ui/ListFilterField";
import { SearchSelect } from "@/components/ui/search-select";
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

/** Compact custom select for list toolbars. Search appears when the list is long. */
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
      <SearchSelect
        id={id}
        size="filter"
        searchable
        value={value}
        onValueChange={onChange}
        options={options}
        aria-label={label}
      />
    </ListFilterField>
  );
}
