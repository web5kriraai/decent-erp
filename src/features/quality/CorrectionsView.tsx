"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import {
  useCorrections,
  useUpdateCorrectionStatus,
} from "@/hooks/use-corrections";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import type { CorrectionRecord } from "@/lib/types/api";

export function CorrectionsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRaise = permissions.includes(PERMISSIONS.CORRECTION_RAISE);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const correctionsQuery = useCorrections(
    { mine: filter === "mine" },
    canRaise,
  );
  const updateStatus = useUpdateCorrectionStatus();

  if (!canRaise) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.CORRECTION_RAISE} />
      </div>
    );
  }

  async function handleStatusChange(row: CorrectionRecord, status: CorrectionRecord["status"]) {
    if (row.status === status) return;
    await updateStatus.mutateAsync({ id: row.id, status: status as never });
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Corrections"
        subtitle="Track mistakes, improvements, and rework responsibility"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setRaiseOpen(true)}>
            Raise Correction
          </button>
        }
      />

      <div className="toolbar" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === "mine" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("mine")}
        >
          My Responsibility
        </button>
      </div>

      <QueryState
        isLoading={correctionsQuery.isLoading}
        isError={correctionsQuery.isError}
        error={correctionsQuery.error}
        onRetry={() => correctionsQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card">
          <DataTable
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row) => (
                  <Link href={ROUTES.designs.detail(row.design.id)} className="data-table-link">
                    {row.design.ideaRef}
                  </Link>
                ),
              },
              {
                key: "task",
                header: "Task",
                render: (row) => `${row.task.process.name} → ${row.task.subProcess.name}`,
              },
              {
                key: "correctionType",
                header: "Type",
                render: (row) => row.correctionType.replace(/_/g, " "),
              },
              {
                key: "responsibleEmployee",
                header: "Responsible",
                render: (row) => row.responsibleEmployee.name,
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <select
                    className="form-select form-select--compact"
                    value={row.status}
                    disabled={updateStatus.isPending}
                    onChange={(e) => handleStatusChange(row, e.target.value)}
                    aria-label={`Status for correction ${row.id}`}
                  >
                    {["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING", "DONE", "REJECTED"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ),
                    )}
                  </select>
                ),
              },
              {
                key: "createdAtUtc",
                header: "Raised",
                render: (row) => new Date(row.createdAtUtc).toLocaleDateString(),
              },
            ]}
            rows={correctionsQuery.data ?? []}
            getRowKey={(row) => row.id}
            emptyTitle="No corrections"
            emptyDescription="Raise a correction when rework is needed on a task."
            emptyAction={
              <button type="button" className="btn btn-primary" onClick={() => setRaiseOpen(true)}>
                Raise Correction
              </button>
            }
          />
        </div>
      </QueryState>

      <RaiseCorrectionModal open={raiseOpen} onClose={() => setRaiseOpen(false)} />
    </div>
  );
}
