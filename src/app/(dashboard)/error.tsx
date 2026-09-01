"use client";

import Link from "next/link";
import { useEffect } from "react";

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
      <div className="card error-state-card">
        <h1>Something went wrong</h1>
        <p className="text-muted-inline stack-section-sm">
          {error.message || "This page could not load. Try refreshing or return to the dashboard."}
        </p>
        <div className="form-actions form-actions--end">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Go to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
