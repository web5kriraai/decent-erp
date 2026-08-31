"use client";

import type { ReactNode } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SkeletonRows } from "@/components/SkeletonRows";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiClientError } from "@/lib/api-client";

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
    const correlationId =
      error instanceof ApiClientError ? error.correlationId : undefined;
    const message =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load data";

    if (error instanceof ApiClientError && error.isForbidden) {
      return (
        <div className="alert alert-warning" role="alert">
          You do not have permission to view this data.
        </div>
      );
    }

    return (
      <ErrorBanner
        message={message}
        correlationId={correlationId}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <div className="card">
        <EmptyState
          title={emptyTitle ?? "No data"}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return <>{children}</>;
}
