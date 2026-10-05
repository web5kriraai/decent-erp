"use client";

import { Input } from "@/components/ui/input";
import { ListFilterField } from "@/components/ui/ListFilterField";
import { cn } from "@/lib/utils";

export type ListPeriodFilterProps = {
  yearId?: string;
  monthId?: string;
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  className?: string;
};

/** Compact Year/Month pair for report list toolbars. */
export function ListPeriodFilter({
  yearId = "list-filter-year",
  monthId = "list-filter-month",
  year,
  month,
  onYearChange,
  onMonthChange,
  className,
}: ListPeriodFilterProps) {
  return (
    <div
      className={cn("list-period-filter", className)}
      role="group"
      aria-label="Period"
    >
      <ListFilterField id={yearId} label="Year">
        <Input
          id={yearId}
          type="number"
          value={String(year)}
          onChange={(e) => onYearChange(Number(e.target.value) || year)}
          className="list-filter-control list-filter-control--year !w-auto"
        />
      </ListFilterField>
      <ListFilterField id={monthId} label="Month">
        <Input
          id={monthId}
          type="number"
          min={1}
          max={12}
          value={String(month)}
          onChange={(e) => {
            const next = Number(e.target.value) || month;
            onMonthChange(Math.min(12, Math.max(1, next)));
          }}
          className="list-filter-control list-filter-control--month !w-auto"
        />
      </ListFilterField>
    </div>
  );
}
