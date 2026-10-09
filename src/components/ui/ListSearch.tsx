"use client";

import { IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ListSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  id?: string;
};

/** Canonical list search field - search icon + input. */
export function ListSearch({
  value,
  onChange,
  placeholder = "Search…",
  "aria-label": ariaLabel = "Search records",
  className,
  id,
}: ListSearchProps) {
  return (
    <div className={cn("list-search relative min-w-[12rem] w-full sm:max-w-sm", className)}>
      <IconSearch
        size={16}
        className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
        aria-label={ariaLabel}
      />
    </div>
  );
}
