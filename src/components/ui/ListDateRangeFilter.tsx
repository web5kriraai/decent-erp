"use client";

import { Input } from "@/components/ui/input";
import { ListFilterField } from "@/components/ui/ListFilterField";
import { cn } from "@/lib/utils";

export type ListDateRangeFilterProps = {
  fromId?: string;
  toId?: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
};

/** Compact From/To date pair for list toolbars — labels inline, not stacked. */
export function ListDateRangeFilter({
  fromId = "list-filter-from",
  toId = "list-filter-to",
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: ListDateRangeFilterProps) {
  return (
    <div
      className={cn("list-date-range", className)}
      role="group"
      aria-label="Date range"
    >
      <ListFilterField id={fromId} label="From">
        <Input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="list-filter-control list-filter-control--date !w-auto"
        />
      </ListFilterField>
      <span className="list-date-range__sep" aria-hidden>
        –
      </span>
      <ListFilterField id={toId} label="To">
        <Input
          id={toId}
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="list-filter-control list-filter-control--date !w-auto"
        />
      </ListFilterField>
    </div>
  );
}
