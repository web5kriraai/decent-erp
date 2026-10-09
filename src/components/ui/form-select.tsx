"use client";

import { FormSearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

export type FormSelectOption = SearchSelectOption;

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
  /** Kept for existing call sites. Search results use the shared popup. */
  contentClassName?: string;
  hint?: string;
  error?: string;
};

/**
 * Labeled dropdown with search. Used for roles, stages, people, and every other select
 * so long lists stay usable.
 */
export function FormSelect({
  triggerClassName: _triggerClassName,
  contentClassName: _contentClassName,
  ...props
}: FormSelectProps) {
  return <FormSearchSelect searchable {...props} />;
}
