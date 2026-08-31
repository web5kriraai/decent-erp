"use client";

import type { ComponentProps } from "react";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FormTextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export function FormTextArea({
  id,
  label,
  required,
  hint,
  error,
  fieldClassName,
  className,
  ...props
}: FormTextAreaProps) {
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
        aria-invalid={error ? true : undefined}
        className={cn("resize-none", className)}
        {...props}
      />
    </FormField>
  );
}
