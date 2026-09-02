"use client";

import { useEffect } from "react";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell">
      <AppCard title="Something went wrong" className="error-state-card">
        <p className="text-sm text-muted-foreground">
          {error.message || "This page could not load. Try refreshing or return to the dashboard."}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <AppButton type="button" onClick={() => reset()}>
            Try again
          </AppButton>
          <AppButtonLink href="/dashboard" appVariant="secondary">
            Go to Overview
          </AppButtonLink>
        </div>
      </AppCard>
    </div>
  );
}
