"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { ListPage } from "@/components/ui/ListPage";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import {
  useCorrections,
  useUpdateCorrectionStatus,
} from "@/hooks/use-corrections";
import { useClientList } from "@/hooks/use-client-list";
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

function isOpenStatus(status: string): boolean {
  const s = normalizeCorrectionStatus(status);
  return s !== "DONE" && s !== "REJECTED";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function correctionSearchText(row: CorrectionRecord) {
  return [
    row.id,
    row.design.ideaRef,
    row.rootCause,
    row.task.process.name,
    row.task.subProcess.name,
    row.responsibleEmployee?.name,
    row.raisedBy.name,
    row.correctionType,
    row.status,
  ]
    .filter(Boolean)
    .join(" ");
}

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

  const rows = correctionsQuery.data ?? [];

  const stats = useMemo(() => {
    let open = 0;
    let mistakes = 0;
    let improvements = 0;
    let extraCost = 0;
    for (const row of rows) {
      if (isOpenStatus(row.status)) open += 1;
      const type = row.correctionType.toUpperCase();
      if (type.includes("MISTAKE")) mistakes += 1;
      if (type.includes("IMPROVEMENT")) improvements += 1;
      if (row.extraCost != null) extraCost += Number(row.extraCost) || 0;
    }
    return { open, mistakes, improvements, extraCost };
  }, [rows]);

  const timeline = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
        )
        .slice(0, 8),
    [rows],
  );

  const getSearchText = useCallback(correctionSearchText, []);

  const list = useClientList({
    items: rows,
    getSearchText,
  });

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
    <ListPage
      title="Correction Management"
        subtitle="Track every correction, mistake owner, improvement and cost impact"
        actions={
          <ContextualActionsPanel
            actions={pageActions}
            onAction={handlePageAction}
            showDisabled={false}
          />
        }
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: "Search design, issue, person…",
          "aria-label": "Search corrections",
        }}
        onRefresh={() => correctionsQuery.refetch()}
        isRefreshing={correctionsQuery.isFetching}
        beforeTable={
          <>
            <div className="stat-grid">
              <StatCard
                label="Open Corrections"
                value={stats.open}
                trend={`${rows.length} total`}
                tone={stats.open > 0 ? "warning" : "success"}
              />
              <StatCard
                label="Mistakes"
                value={stats.mistakes}
                trend="Rating applies"
                tone="danger"
              />
              <StatCard
                label="Improvements"
                value={stats.improvements}
                trend="No penalty"
                tone="accent"
              />
              <StatCard
                label="Extra Cost"
                value={`₹${stats.extraCost.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`}
                trend="Logged impact"
              />
            </div>

            {timeline.length > 0 ? (
              <div className="stack-section-sm">
                <p className="text-sm font-medium m-0">Recent activity</p>
                <ul className="event-timeline">
                  {timeline.map((row) => (
                    <li key={row.id} className="event-timeline-item">
                      <span className="event-timeline-dot" aria-hidden />
                      <p className="event-timeline-title">
                        COR-{row.id.slice(-4)} —{" "}
                        {row.rootCause?.trim() ||
                          row.correctionType.replace(/_/g, " ")}
                      </p>
                      <p className="event-timeline-meta">
                        {formatWhen(row.createdAtUtc)} · {row.raisedBy.name} ·{" "}
                        {row.design.ideaRef}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        }
        query={{
          isLoading: correctionsQuery.isLoading,
          isError: correctionsQuery.isError,
          error: correctionsQuery.error,
          onRetry: () => correctionsQuery.refetch(),
        }}
        pagination={{
          total: list.total,
          page: list.page,
          pageSize: list.pageSize,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
          pageSizeSelectId: "corrections-page-size",
        }}
        overlays={
          <RaiseCorrectionModal open={raiseOpen} onClose={() => setRaiseOpen(false)} />
        }
      >
        <DataTable
          flush
          columns={[
            {
              key: "id",
              header: "No.",
              render: (row) => (
                <span className="font-medium">COR-{row.id.slice(-4)}</span>
              ),
            },
            {
              key: "design",
              header: "Design",
              render: (row) => (
                <Link
                  href={ROUTES.designs.detail(row.design.id)}
                  className="data-table-link"
                >
                  {row.design.ideaRef}
                </Link>
              ),
            },
            {
              key: "issue",
              header: "Issue",
              render: (row) =>
                row.rootCause?.trim() ||
                `${row.task.process.name} → ${row.task.subProcess.name}`,
            },
            {
              key: "responsibleEmployee",
              header: "Person",
              render: (row) =>
                row.responsibleEmployee?.name ?? row.raisedBy.name,
            },
            {
              key: "correctionType",
              header: "Type",
              render: (row) => row.correctionType.replace(/_/g, " "),
            },
            {
              key: "extraCost",
              header: "Cost",
              align: "right",
              render: (row) =>
                row.extraCost != null ? Number(row.extraCost).toFixed(0) : "—",
            },
            {
              key: "status",
              header: "Status",
              render: (row) => {
                const displayStatus = normalizeCorrectionStatus(row.status);
                const options = getAllowedCorrectionStatusOptions(row.status);
                const terminal =
                  displayStatus === "DONE" || displayStatus === "REJECTED";
                return (
                  <div className="vstack vstack--tight">
                    <StatusBadge status={displayStatus} />
                    <select
                      className="form-select form-select--compact"
                      value={displayStatus}
                      disabled={
                        updateStatus.isPending || terminal || options.length <= 1
                      }
                      onChange={(e) => handleStatusChange(row, e.target.value)}
                      aria-label={`Status for correction ${row.id}`}
                    >
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
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
                      if (
                        action.code === WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION
                      ) {
                        void handleStatusChange(row, "DONE");
                      }
                    }}
                  />
                );
              },
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => row.id}
          emptyTitle="No corrections"
          emptyAction={
            pageActions.some(
              (a) => a.code === WORKFLOW_ACTION_CODES.RAISE_CORRECTION,
            ) ? (
              <AppButton
                type="button"
                appVariant="primary"
                onClick={() => setRaiseOpen(true)}
              >
                Raise Correction
              </AppButton>
            ) : undefined
          }
        />
    </ListPage>
  );
}
