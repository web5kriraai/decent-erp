"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** App-facing variant names mapped to shadcn Button variants. */
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
  return (
    <Button
      variant={variant ?? shadcnVariant[appVariant]}
      className={cn(
        appVariant === "warning" &&
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]/80",
        className,
      )}
      {...props}
    />
  );
}

type AppButtonLinkProps = ComponentProps<typeof Link> & {
  appVariant?: AppButtonVariant;
  size?: "sm" | "default" | "lg" | "xs";
};

export function AppButtonLink({
  appVariant = "primary",
  size = "default",
  className,
  children,
  ...props
}: AppButtonLinkProps) {
  return (
    <Link
      className={cn(
        buttonVariants({
          variant: shadcnVariant[appVariant],
          size,
        }),
        appVariant === "warning" &&
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]/80",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export { buttonVariants };
