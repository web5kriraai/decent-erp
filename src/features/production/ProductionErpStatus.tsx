"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ErpIntegrationStatus, ProductionHandoffRow } from "@/hooks/use-production";
import {
  erpModeDisplayLabel,
  erpModeShortHint,
  formatErpModuleLabel,
  formatErpReferenceDisplay,
  getHandoffDisplayStatus,
} from "@/lib/services/erp-integration-config";
import { useClientList } from "@/hooks/use-client-list";

export function ProductionErpModePill({
  status,
  showErpChainLink,
}: {
  status: ErpIntegrationStatus | undefined;
  showErpChainLink: boolean;
}) {
  const mode = status?.mode ?? "simulated";
  const hint = status?.message ?? erpModeShortHint(mode);
  return (
    <div className="production-desk-erp-pill" title={hint}>
      <StatusBadge
        status={mode === "live" ? "ACTIVE" : "CHECKING"}
        label={erpModeDisplayLabel(mode)}
      />
      <span className="production-desk-erp-hint">{erpModeShortHint(mode)}</span>
      {showErpChainLink ? (
        <Link href={ROUTES.production.erpChain} className="production-desk-erp-link">
          Open ERP Chain
        </Link>
      ) : null}
    </div>
  );
}

function handoffSearchText(row: ProductionHandoffRow) {
  return `${row.design.ideaRef} ${row.erpModule} ${row.designNumber} ${row.status} ${row.erpReference ?? ""} ${row.payload?.error ?? ""}`;
}

export function ProductionErpHandoffsSection({
  handoffs,
  syncPending,
  retryPending,
  onSyncLatest,
  onRetry,
  onRefresh,
  isRefreshing,
}: {
  handoffs: ProductionHandoffRow[];
  syncPending: boolean;
  retryPending: boolean;
  onSyncLatest: (designId: string) => void;
  onRetry: (handoffId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const getSearchText = useCallback(handoffSearchText, []);
  const list = useClientList({ items: handoffs, getSearchText });

  const latestByDesign = useMemo(() => {
    const map = new Map<string, { ideaRef: string; id: string }>();
    for (const row of handoffs) {
      if (!map.has(row.design.id)) {
        map.set(row.design.id, { id: row.design.id, ideaRef: row.design.ideaRef });
      }
    }
    return [...map.values()];
  }, [handoffs]);

  const primaryDesign = latestByDesign[0] ?? null;
  const allLocal =
    handoffs.length > 0 &&
    handoffs.every(
      (h) =>
        getHandoffDisplayStatus({
          status: h.status,
          erpReference: h.erpReference,
        }) === "LOCAL",
    );

  return (
    <AppCard
      title="ERP handoffs"
      className="production-desk-secondary-card overflow-visible"
      description={
        allLocal
          ? "Simulated LOCAL sync — partner posts are stubbed until ERP_API_BASE_URL is set."
          : "Sync status for modules pushed after production release."
      }
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh ? (
            <ListRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
          ) : null}
          {primaryDesign ? (
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={syncPending}
              title={
                latestByDesign.length > 1
                  ? `Syncs ${primaryDesign.ideaRef} (first design in list)`
                  : `Sync ${primaryDesign.ideaRef}`
              }
              onClick={() => onSyncLatest(primaryDesign.id)}
            >
              {syncPending ? "Syncing…" : "Sync latest design"}
            </AppButton>
          ) : null}
        </div>
      }
    >
      <div className="page-toolbar !mb-0 border-b px-3 py-2">
        <ListSearch
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search handoffs…"
          aria-label="Search ERP handoffs"
        />
      </div>
      <DataTable
        flush
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
            key: "erpModule",
            header: "Module",
            render: (row) => (
              <span className="production-desk-erp-module">
                {formatErpModuleLabel(row.erpModule)}
              </span>
            ),
          },
          { key: "designNumber", header: "Design No." },
          {
            key: "status",
            header: "Sync",
            render: (row) => {
              const display = getHandoffDisplayStatus({
                status: row.status,
                erpReference: row.erpReference,
              });
              const badgeStatus =
                display === "LOCAL"
                  ? "CHECKING"
                  : display === "FAILED"
                    ? "REJECTED"
                    : display === "QUEUED"
                      ? "PENDING"
                      : "COMPLETED";
              return <StatusBadge status={badgeStatus} label={display} />;
            },
          },
          {
            key: "error",
            header: "Last error",
            render: (row) =>
              row.payload?.error ? (
                <span className="text-xs text-destructive">{row.payload.error}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "erpReference",
            header: "ERP Ref",
            render: (r) => {
              const ref = formatErpReferenceDisplay(r.erpReference);
              return (
                <span className="production-desk-erp-ref" title={ref.full}>
                  {ref.simulated ? (
                    <span className="production-desk-erp-ref-sim">Sim</span>
                  ) : null}
                  <span className="production-desk-erp-ref-main">{ref.primary}</span>
                  {ref.secondary ? (
                    <span className="production-desk-erp-ref-meta">{ref.secondary}</span>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) =>
              row.status === "FAILED" || row.status === "QUEUED" ? (
                <AppButton
                  type="button"
                  appVariant="secondary"
                  size="sm"
                  disabled={retryPending}
                  onClick={() => onRetry(row.id)}
                >
                  Retry
                </AppButton>
              ) : null,
          },
        ]}
        rows={list.pageItems}
        getRowKey={(r) => r.id}
        emptyTitle="No ERP handoffs yet"
        emptyDescription="Handoffs appear when a design is released to production."
      />
      {list.total > 0 ? (
        <PaginationBar
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          pageSizeSelectId="production-handoffs-page-size"
        />
      ) : null}
    </AppCard>
  );
}
