"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ErpIntegrationStatus, ProductionHandoffRow } from "@/hooks/use-production";
import {
  erpModeDisplayLabel,
  erpModeShortHint,
  formatErpModuleLabel,
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

type DesignHandoffGroup = {
  designId: string;
  ideaRef: string;
  collectionName: string;
  designNumber: string;
  modules: string[];
  sync: string;
  failedId: string | null;
  error: string | null;
};

function groupHandoffs(rows: ProductionHandoffRow[]): DesignHandoffGroup[] {
  const map = new Map<string, DesignHandoffGroup>();
  for (const row of rows) {
    const sync = getHandoffDisplayStatus({
      status: row.status,
      erpReference: row.erpReference,
    });
    const existing = map.get(row.design.id);
    if (!existing) {
      map.set(row.design.id, {
        designId: row.design.id,
        ideaRef: row.design.ideaRef,
        collectionName: row.design.collectionName,
        designNumber: row.designNumber,
        modules: [formatErpModuleLabel(row.erpModule)],
        sync,
        failedId: sync === "FAILED" ? row.id : null,
        error: row.payload?.error ?? null,
      });
      continue;
    }
    existing.modules.push(formatErpModuleLabel(row.erpModule));
    if (sync === "FAILED") {
      existing.sync = "FAILED";
      existing.failedId = row.id;
      existing.error = row.payload?.error ?? existing.error;
    } else if (existing.sync !== "FAILED" && existing.sync !== sync) {
      existing.sync = "MIXED";
    }
  }
  return [...map.values()];
}

function handoffSearchText(row: DesignHandoffGroup) {
  return `${row.ideaRef} ${row.collectionName} ${row.designNumber} ${row.modules.join(" ")} ${row.sync} ${row.error ?? ""}`;
}

export function ProductionErpHandoffsSection({
  handoffs,
  syncPending,
  retryPending,
  onSyncLatest,
  onRetry,
}: {
  handoffs: ProductionHandoffRow[];
  syncPending: boolean;
  retryPending: boolean;
  onSyncLatest: (designId: string) => void;
  onRetry: (handoffId: string) => void;
}) {
  const groups = useMemo(() => groupHandoffs(handoffs), [handoffs]);
  const getSearchText = useCallback(handoffSearchText, []);
  const list = useClientList({ items: groups, getSearchText });

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
    <div className="production-desk-secondary-card">
      <div className="production-desk-secondary-body">
      {allLocal ? (
        <p className="production-desk-note">
          Simulated sync until the ERP connection is set.
        </p>
      ) : null}
      <div className="page-toolbar !mb-0 border-b px-3 py-2">
        <ListSearch
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search handoffs…"
          aria-label="Search ERP handoffs"
        />
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
            {syncPending ? "Syncing…" : "Sync latest"}
          </AppButton>
        ) : null}
      </div>
      <div className="production-desk-secondary-scroll">
      <DataTable
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => (
              <Link href={ROUTES.designs.detail(row.designId)} className="concept-board-design">
                <span className="concept-board-line" title={`${row.collectionName} · ${row.ideaRef}`}>
                  <span className="concept-board-line__title data-table-link">
                    {row.collectionName}
                  </span>
                  <span className="data-table-subtext concept-board-line__meta">
                    {row.ideaRef}
                    {row.designNumber ? ` · ${row.designNumber}` : ""}
                  </span>
                </span>
              </Link>
            ),
          },
          {
            key: "modules",
            header: "Modules",
            render: (row) => (
              <span title={row.modules.join(", ")}>
                {row.modules.length} modules
              </span>
            ),
          },
          {
            key: "status",
            header: "Sync",
            render: (row) => {
              const badgeStatus =
                row.sync === "LOCAL" || row.sync === "MIXED"
                  ? "CHECKING"
                  : row.sync === "FAILED"
                    ? "REJECTED"
                    : row.sync === "QUEUED"
                      ? "PENDING"
                      : "COMPLETED";
              const label = row.sync === "MIXED" ? "Mixed" : row.sync;
              return <StatusBadge status={badgeStatus} label={label} />;
            },
          },
          {
            key: "error",
            header: "Last error",
            render: (row) =>
              row.error ? (
                <span className="text-xs text-destructive">{row.error}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) =>
              row.failedId ? (
                <AppButton
                  type="button"
                  appVariant="secondary"
                  size="sm"
                  disabled={retryPending}
                  onClick={() => onRetry(row.failedId!)}
                >
                  Retry
                </AppButton>
              ) : null,
          },
        ]}
        rows={list.pageItems}
        getRowKey={(r) => r.designId}
        emptyTitle="No ERP handoffs yet"
        emptyDescription="Handoffs appear when a design is released to production."
      />
      </div>
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
      </div>
    </div>
  );
}
