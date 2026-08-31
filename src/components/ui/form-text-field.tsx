"use client";

import type { ComponentProps } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FormTextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export function FormTextField({
  id,
  label,
  required,
  hint,
  error,
  fieldClassName,
  className,
  ...props
}: FormTextFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={fieldClassName}
    >
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(className)}
        {...props}
      />
    </FormField>
  );
}
