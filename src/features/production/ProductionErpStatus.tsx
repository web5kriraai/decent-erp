"use client";

import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ErpIntegrationStatus, ProductionHandoffRow } from "@/hooks/use-production";
import {
  getHandoffDisplayStatus,
  isSimulatedErpReference,
} from "@/lib/services/erp-integration-config";

export function ProductionErpModePill({
  status,
  showErpChainLink,
}: {
  status: ErpIntegrationStatus | undefined;
  showErpChainLink: boolean;
}) {
  const mode = status?.mode ?? "simulated";
  return (
    <div className="production-desk-erp-pill">
      <StatusBadge
        status={mode === "live" ? "ACTIVE" : "CHECKING"}
        label={mode === "live" ? "Live ERP" : "Simulated ERP"}
      />
      {showErpChainLink ? (
        <Link href={ROUTES.production.erpChain} className="data-table-link text-sm">
          ERP Chain
        </Link>
      ) : null}
    </div>
  );
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
  const handoffDesignIds = [...new Set(handoffs.map((h) => h.design.id))];

  return (
    <AppCard
      title="ERP handoffs"
      className="stack-section"
      description="Grey → Accounts sync after production release."
      headerAction={
        handoffDesignIds.length > 0 ? (
          <AppButton
            type="button"
            appVariant="secondary"
            size="sm"
            disabled={syncPending}
            onClick={() => onSyncLatest(handoffDesignIds[0]!)}
          >
            Sync all modules (latest)
          </AppButton>
        ) : null
      }
    >
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
          { key: "erpModule", header: "Module" },
          { key: "designNumber", header: "Design No." },
          {
            key: "status",
            header: "Sync Status",
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
                <span className="text-xs text-muted-foreground">{row.payload.error}</span>
              ) : (
                "—"
              ),
          },
          {
            key: "erpReference",
            header: "ERP Ref",
            render: (r) => (
              <span className="inline-flex items-center gap-2">
                <span>{r.erpReference ?? "—"}</span>
                {isSimulatedErpReference(r.erpReference) ? (
                  <StatusBadge status="CHECKING" label="Simulated" />
                ) : null}
              </span>
            ),
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
                  Retry sync
                </AppButton>
              ) : null,
          },
        ]}
        rows={handoffs}
        getRowKey={(r) => r.id}
        emptyTitle="No ERP handoffs yet"
        emptyDescription="Handoffs are created when designs are released to production."
      />
    </AppCard>
  );
}
