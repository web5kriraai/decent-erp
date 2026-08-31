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
      <div className="card" style={{ maxWidth: 480, margin: "2rem auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "var(--color-neutral-500)", marginBottom: "1.5rem" }}>
          {error.message || "This page could not load. Try refreshing or return to the dashboard."}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
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
