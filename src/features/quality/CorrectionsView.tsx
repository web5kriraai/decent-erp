"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { ListPage } from "@/components/ui/ListPage";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchSelect } from "@/components/ui/search-select";
import { PermissionDenied } from "@/components/PermissionDenied";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import { WorkdayStatusBanner } from "@/features/time/WorkdayStatusBanner";
import {
  useCorrections,
  useUpdateCorrectionStatus,
} from "@/hooks/use-corrections";
import { useClientList } from "@/hooks/use-client-list";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import type { CorrectionRecord } from "@/lib/types/api";
import { correctionReworkStillOpen } from "@/lib/correction-rework";
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

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  REJECTED: "Rejected",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function isOpenStatus(status: string): boolean {
  const s = normalizeCorrectionStatus(status);
  return s !== "DONE" && s !== "REJECTED";
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
  const canView =
    permissions.includes(PERMISSIONS.CORRECTION_RAISE) ||
    permissions.includes(PERMISSIONS.CORRECTION_REQUEST) ||
    permissions.includes(PERMISSIONS.CORRECTION_EXECUTE);
  const canRaise =
    permissions.includes(PERMISSIONS.CORRECTION_RAISE) ||
    permissions.includes(PERMISSIONS.CORRECTION_REQUEST);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [reviewerInbox, setReviewerInbox] = useState(false);

  const correctionsQuery = useCorrections(
    reviewerInbox ? { reviewerInbox: true } : undefined,
    canView,
  );
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

  const getSearchText = useCallback(correctionSearchText, []);

  const list = useClientList({
    items: rows,
    getSearchText,
  });

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.CORRECTION_REQUEST} />
      </div>
    );
  }

  function handleStatusChange(row: CorrectionRecord, status: string) {
    const next = normalizeCorrectionStatus(status) as CorrectionWorkflowStatus;
    const current = normalizeCorrectionStatus(row.status);
    if (current === next) return;
    if (next === "DONE" && correctionReworkStillOpen(row)) return;
    updateStatus.mutate({ id: row.id, status: next });
  }

  function handlePageAction(action: ResolvedWorkflowAction) {
    if (action.code === WORKFLOW_ACTION_CODES.RAISE_CORRECTION) {
      setRaiseOpen(true);
    }
  }

  return (
    <ListPage
      className="corrections-page"
      title="Correction Management"
        subtitle="Rework on a design: who owns it, and whether it is a mistake or an improvement."
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
        toolbarExtra={
          <AppButton
            type="button"
            appVariant={reviewerInbox ? "primary" : "outline"}
            size="sm"
            onClick={() => setReviewerInbox((v) => !v)}
          >
            {reviewerInbox ? "Reviewer inbox" : "All corrections"}
          </AppButton>
        }
        beforeTable={
          <>
            <WorkdayStatusBanner />
            <div className="stat-grid">
              <StatCard
                label="Open Corrections"
                value={stats.open}
                trend={stats.open > 0 ? "Still to finish" : "None waiting"}
                tone={stats.open > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Mistakes"
                value={stats.mistakes}
                trend="Affects the person's rating"
                tone={stats.mistakes > 0 ? "danger" : "default"}
              />
              <StatCard
                label="Improvements"
                value={stats.improvements}
                trend="Does not affect the rating"
                tone={stats.improvements > 0 ? "accent" : "default"}
              />
              <StatCard
                label="Extra Cost"
                value={`₹${stats.extraCost.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`}
                trend="Added cost from rework"
              />
            </div>
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
              key: "design",
              header: "Design",
              render: (row) => {
                const cycle = row.cycleNo != null && row.cycleNo > 1 ? `Cycle ${row.cycleNo}` : null;
                const meta = [`COR-${row.id.slice(-4)}`, row.design.ideaRef, cycle]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link href={ROUTES.designs.detail(row.design.id)} className="concept-board-design">
                    <span className="concept-board-line" title={`${row.design.collectionName} · ${meta}`}>
                      <span className="concept-board-line__title data-table-link">
                        {row.design.collectionName}
                      </span>
                      <span className="data-table-subtext concept-board-line__meta">{meta}</span>
                    </span>
                  </Link>
                );
              },
            },
            {
              key: "issue",
              header: "Issue",
              render: (row) => {
                const note = row.rootCause?.trim();
                const stage = row.task.subProcess?.name ?? row.task.process?.name ?? "Stage";
                return (
                  <div className="concept-board-line" title={note ? `${stage} · ${note}` : stage}>
                    <span className="concept-board-line__title">{stage}</span>
                    {note ? (
                      <span className="data-table-subtext concept-board-line__meta">{note}</span>
                    ) : null}
                  </div>
                );
              },
            },
            {
              key: "responsibleEmployee",
              header: "Person",
              render: (row) => (
                <span className="concept-board-line__title">
                  {row.responsibleEmployee?.name ?? row.raisedBy.name}
                </span>
              ),
            },
            {
              key: "correctionType",
              header: "Type",
              render: (row) =>
                row.correctionType
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/^\w/, (letter) => letter.toUpperCase()),
            },
            {
              key: "extraCost",
              header: "Cost",
              align: "right",
              render: (row) =>
                row.extraCost != null ? `₹${Number(row.extraCost).toFixed(0)}` : "-",
            },
            {
              key: "status",
              header: "Status",
              render: (row) => {
                const displayStatus = normalizeCorrectionStatus(row.status);
                const reworkOpen = correctionReworkStillOpen(row);
                const options = getAllowedCorrectionStatusOptions(row.status).filter(
                  (status) => !(reworkOpen && status === "DONE"),
                );
                const terminal =
                  displayStatus === "DONE" || displayStatus === "REJECTED";
                const reworkNote = reworkOpen
                  ? [
                      "Waiting",
                      row.routedTask?.subProcess?.name,
                      row.routedTask?.assignedEmployee?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : null;
                return (
                  <div className="concept-board-line corrections-status" title={reworkNote ?? statusLabel(displayStatus)}>
                    {terminal || options.length <= 1 ? (
                      <StatusBadge status={displayStatus} label={statusLabel(displayStatus)} />
                    ) : (
                      <SearchSelect
                        size="compact"
                        searchable={false}
                        value={displayStatus}
                        disabled={updateStatus.isPending}
                        onValueChange={(next) => handleStatusChange(row, next)}
                        aria-label={`Status for correction ${row.id}`}
                        options={options.map((s) => ({
                          value: s,
                          label: statusLabel(s),
                        }))}
                      />
                    )}
                    {reworkNote ? (
                      <span className="data-table-subtext concept-board-line__meta">{reworkNote}</span>
                    ) : null}
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
