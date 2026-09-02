"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import {
  useCorrections,
  useUpdateCorrectionStatus,
} from "@/hooks/use-corrections";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { resolveCorrectionContextActions } from "@/lib/workflow-actions";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import type { CorrectionRecord } from "@/lib/types/api";

export function CorrectionsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRaise = permissions.includes(PERMISSIONS.CORRECTION_RAISE);

  const [raiseOpen, setRaiseOpen] = useState(false);

  const correctionsQuery = useCorrections(undefined, canRaise);
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

  const correctionActions = resolveCorrectionContextActions({ permissions });

  return (
    <div className="page-shell">
      <PageHeader
        title="Corrections"
        subtitle="Corrections you raised, own on a task, or are responsible for fixing"
        actions={
          <AppButton type="button" appVariant="primary" onClick={() => setRaiseOpen(true)}>
            Raise Correction
          </AppButton>
        }
      />

      <QueryState
        isLoading={correctionsQuery.isLoading}
        isError={correctionsQuery.isError}
        error={correctionsQuery.error}
        onRetry={() => correctionsQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard>
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
                key: "extraMinutes",
                header: "Extra min",
                align: "right",
                render: (row) =>
                  row.extraMinutes != null ? String(row.extraMinutes) : "—",
              },
              {
                key: "extraCost",
                header: "Extra cost",
                align: "right",
                render: (row) =>
                  row.extraCost != null ? Number(row.extraCost).toFixed(2) : "—",
              },
              {
                key: "responsibleEmployee",
                header: "Responsible",
                render: (row) =>
                  row.responsibleEmployee
                    ? row.responsibleEmployee.name
                    : "—",
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
            ]}
            rows={correctionsQuery.data ?? []}
            getRowKey={(row) => row.id}
            emptyTitle="No corrections"
            emptyDescription="When you raise a correction or one is assigned to you, it appears here."
            emptyAction={
              <AppButton type="button" appVariant="primary" onClick={() => setRaiseOpen(true)}>
                Raise Correction
              </AppButton>
            }
          />
        </AppCard>
      </QueryState>

      <RaiseCorrectionModal open={raiseOpen} onClose={() => setRaiseOpen(false)} />
    </div>
  );
}
