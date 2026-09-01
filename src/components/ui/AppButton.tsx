"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Legacy `.btn-*` names mapped to shadcn Button variants during migration. */
export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "warning";

const shadcnVariant: Record<
  AppButtonVariant,
  NonNullable<ComponentProps<typeof Button>["variant"]>
> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
  outline: "outline",
  warning: "secondary",
};

type AppButtonProps = ComponentProps<typeof Button> & {
  appVariant?: AppButtonVariant;
};

export function AppButton({
  appVariant = "primary",
  variant,
  className,
  ...props
}: AppButtonProps) {
  const legacyClass =
    appVariant === "warning"
      ? "btn-warning"
      : appVariant === "outline"
        ? "btn-outline"
        : undefined;

  return (
    <Button
      variant={variant ?? shadcnVariant[appVariant]}
      className={cn(legacyClass, className)}
      {...props}
    />
  );
}

type AppButtonLinkProps = ComponentProps<typeof Link> & {
  appVariant?: AppButtonVariant;
  size?: "sm" | "default" | "lg";
};

export function AppButtonLink({
  appVariant = "primary",
  size = "default",
  className,
  children,
  ...props
}: AppButtonLinkProps) {
  const legacy =
    appVariant === "primary"
      ? "btn-primary"
      : appVariant === "secondary"
        ? "btn-secondary"
        : appVariant === "ghost"
          ? "btn-ghost"
          : appVariant === "danger"
            ? "btn-danger"
            : appVariant === "outline"
              ? "btn-outline"
              : "btn-warning";

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  return (
    <Link className={cn("btn", legacy, sizeClass, className)} {...props}>
      {children}
    </Link>
  );
}

export { buttonVariants };
