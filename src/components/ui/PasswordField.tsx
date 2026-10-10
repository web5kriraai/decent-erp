"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  className?: string;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="login-password-field">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          className="login-password-field__input"
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
    </div>
  );
}
