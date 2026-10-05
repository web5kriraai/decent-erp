"use client";

import { IconRefreshCw } from "@/components/icons";
import { AppButton } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";

export type ListRefreshButtonProps = {
  onRefresh: () => void;
  isRefreshing?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
};

/** Canonical refresh control for list pages. */
export function ListRefreshButton({
  onRefresh,
  isRefreshing = false,
  label = "Refresh",
  className,
  disabled,
}: ListRefreshButtonProps) {
  return (
    <AppButton
      type="button"
      appVariant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={disabled || isRefreshing}
      className={cn("list-refresh-btn", className)}
      aria-label={label}
    >
      <IconRefreshCw
        size={14}
        className={cn(isRefreshing && "animate-spin")}
        aria-hidden
      />
      {label}
    </AppButton>
  );
}
