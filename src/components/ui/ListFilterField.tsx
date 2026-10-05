"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ListFilterFieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
  /** Hide visible label (still available via aria on the control). */
  labelHidden?: boolean;
};

/** Compact inline label + control for list toolbars (one row, no stacked labels). */
export function ListFilterField({
  id,
  label,
  children,
  className,
  labelHidden = false,
}: ListFilterFieldProps) {
  return (
    <div className={cn("list-filter-field", className)}>
      <label
        htmlFor={id}
        className={cn("list-filter-field__label", labelHidden && "sr-only")}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export type ListFilterGroupProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Horizontal filter cluster that fills remaining toolbar width. */
export function ListFilterGroup({
  children,
  className,
  "aria-label": ariaLabel = "Filters",
}: ListFilterGroupProps) {
  return (
    <div className={cn("list-filter-group", className)} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
