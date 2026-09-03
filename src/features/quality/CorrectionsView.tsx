"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import {
  useCorrections,
  useUpdateCorrectionStatus,
} from "@/hooks/use-corrections";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import type { CorrectionRecord } from "@/lib/types/api";
import {
  getAllowedCorrectionStatusOptions,
  normalizeCorrectionStatus,
  type CorrectionWorkflowStatus,
} from "@/lib/services/correction-queue-utils";
import {
  resolveCorrectionContextActions,
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions";

export function CorrectionsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRaise = permissions.includes(PERMISSIONS.CORRECTION_RAISE);

  const [raiseOpen, setRaiseOpen] = useState(false);

  const correctionsQuery = useCorrections(undefined, canRaise);
  const updateStatus = useUpdateCorrectionStatus();

  const pageActions = useMemo(
    () => resolveCorrectionContextActions({ permissions, includeRaise: true }),
    [permissions],
  );

  if (!canRaise) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.CORRECTION_RAISE} />
      </div>
    );
  }

  async function handleStatusChange(row: CorrectionRecord, status: string) {
    const next = normalizeCorrectionStatus(status) as CorrectionWorkflowStatus;
    const current = normalizeCorrectionStatus(row.status);
    if (current === next) return;
    await updateStatus.mutateAsync({ id: row.id, status: next });
  }

  function handlePageAction(action: ResolvedWorkflowAction) {
    if (action.code === WORKFLOW_ACTION_CODES.RAISE_CORRECTION) {
      setRaiseOpen(true);
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Corrections"
        subtitle="Corrections you raised, own on a task, or are responsible for fixing"
        actions={
          <ContextualActionsPanel
            actions={pageActions}
            onAction={handlePageAction}
            showDisabled={false}
          />
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
                render: (row) => {
                  const displayStatus = normalizeCorrectionStatus(row.status);
                  const options = getAllowedCorrectionStatusOptions(row.status);
                  const terminal = displayStatus === "DONE" || displayStatus === "REJECTED";
                  return (
                    <select
                      className="form-select form-select--compact"
                      value={displayStatus}
                      disabled={updateStatus.isPending || terminal || options.length <= 1}
                      onChange={(e) => handleStatusChange(row, e.target.value)}
                      aria-label={`Status for correction ${row.id}`}
                    >
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  );
                },
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => {
                  const rowActions = resolveCorrectionContextActions({
                    permissions,
                    correction: row,
                    includeRaise: false,
                  });
                  return (
                    <ContextualActionsPanel
                      actions={rowActions}
                      showDisabled={false}
                      onAction={(action) => {
                        if (action.code === WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION) {
                          void handleStatusChange(row, "DONE");
                        }
                      }}
                    />
                  );
                },
              },
            ]}
            rows={correctionsQuery.data ?? []}
            getRowKey={(row) => row.id}
            emptyTitle="No corrections"
            emptyDescription="When you raise a correction or one is assigned to you, it appears here."
            emptyAction={
              pageActions.some((a) => a.code === WORKFLOW_ACTION_CODES.RAISE_CORRECTION) ? (
                <AppButton type="button" appVariant="primary" onClick={() => setRaiseOpen(true)}>
                  Raise Correction
                </AppButton>
              ) : undefined
            }
          />
        </AppCard>
      </QueryState>

      <RaiseCorrectionModal open={raiseOpen} onClose={() => setRaiseOpen(false)} />
    </div>
  );
}
