"use client";

import type { ComponentProps, KeyboardEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { handleEnterSubmitKeyDown } from "@/lib/ui/enter-submit";
import { cn } from "@/lib/utils";

type FormTextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  /** Enter submits; Shift+Enter keeps newline. Ignored when textarea is disabled. */
  onEnterSubmit?: () => void;
};

export function FormTextArea({
  id,
  label,
  required,
  hint,
  error,
  fieldClassName,
  className,
  onEnterSubmit,
  onKeyDown,
  disabled,
  ...props
}: FormTextAreaProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    handleEnterSubmitKeyDown(event, onEnterSubmit, { disabled: !!disabled });
    onKeyDown?.(event);
  }

  return (
    <FormField
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={fieldClassName}
    >
      <Textarea
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn("resize-none", className)}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </FormField>
  );
}
