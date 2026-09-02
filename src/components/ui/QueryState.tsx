"use client";

import type { ReactNode } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SkeletonRows } from "@/components/SkeletonRows";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiClientError } from "@/lib/api-client";
import { humanizeApiError } from "@/lib/humanize-api-error";
import { messageForCode, APP_ERROR_CODES } from "@/lib/errors/app-errors";

type QueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonVariant?: "table" | "cards" | "stats";
  onRetry?: () => void;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeletonVariant = "table",
  onRetry,
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <SkeletonRows variant={skeletonVariant} />;
  }

  if (isError) {
    const humanized = humanizeApiError(error, "Failed to load data");
    const correlationId =
      error instanceof ApiClientError ? error.correlationId : humanized.correlationId;

    if (error instanceof ApiClientError && error.isForbidden) {
      return (
        <AppCard flat>
          <p className="text-sm text-[var(--color-warning)]" role="alert">
            {messageForCode(APP_ERROR_CODES.PERMISSION_DENIED)}
          </p>
        </AppCard>
      );
    }

    return (
      <ErrorBanner
        message={humanized.title}
        correlationId={correlationId}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle ?? "No data"}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
}
