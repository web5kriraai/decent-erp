"use client";

import { Combobox } from "@base-ui/react/combobox";
import { IconCheck, IconChevronDown, IconSearch } from "@/components/icons";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SearchSelectSize = "default" | "compact" | "filter";

type SearchSelectProps = {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Type to filter options. Off keeps a custom menu without a search field. */
  searchable?: boolean;
  size?: SearchSelectSize;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

type Item = SearchSelectOption;

const popupClass =
  "relative isolate z-[80] max-h-72 min-w-[max(9rem,var(--anchor-width))] max-w-[min(28rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10";

const itemClass =
  "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

export function SearchSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  searchable = true,
  size = "default",
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: SearchSelectProps) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(next) => {
        if (next && typeof next === "object" && "value" in next) {
          onValueChange(String(next.value));
        }
      }}
      disabled={disabled}
      autoHighlight
      itemToStringLabel={(item: Item) => item.label}
      isItemEqualToValue={(item: Item, current: Item) => item.value === current.value}
    >
      <div
        className={cn(
          "relative",
          size === "filter" ? "w-auto min-w-[8.5rem] max-w-[14rem]" : "w-full",
          size === "compact" && "min-w-[11rem]",
          className,
        )}
      >
        {searchable ? (
          <IconSearch
            size={14}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <Combobox.Input
          id={id}
          placeholder={selected ? undefined : placeholder}
          readOnly={!searchable}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid || undefined}
          aria-required={ariaRequired || undefined}
          className={cn(
            "flex h-8 w-full items-center rounded-lg border border-input bg-transparent py-1 pr-8 text-sm text-foreground outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            searchable ? "pl-7" : "cursor-pointer pl-2.5",
            size === "compact" && "h-7 text-xs",
            size === "filter" && "h-8 cursor-pointer",
          )}
        />
        <Combobox.Trigger
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground"
          aria-label={ariaLabel ? `Open ${ariaLabel}` : "Open options"}
        >
          <IconChevronDown size={14} aria-hidden />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start" className="isolate z-[80]">
          <Combobox.Popup className={popupClass}>
            <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
              No matches
            </Combobox.Empty>
            <Combobox.List>
              {(item: Item) => (
                <Combobox.Item
                  key={item.value || "__empty"}
                  value={item}
                  disabled={item.disabled}
                  className={itemClass}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <IconCheck size={14} aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

type FormSearchSelectProps = Omit<SearchSelectProps, "aria-label" | "aria-invalid" | "aria-required"> & {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

export function FormSearchSelect({
  id,
  label,
  required,
  hint,
  error,
  className,
  ...props
}: FormSearchSelectProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <SearchSelect
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        {...props}
      />
    </FormField>
  );
}
