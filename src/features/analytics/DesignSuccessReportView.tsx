"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { AppCard } from "@/components/ui/AppCard";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignSuccessReport } from "@/hooks/use-reports";
import { useErpIntegrationStatus } from "@/hooks/use-production";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

type DesignSuccessSyncResult = {
  ingested: boolean;
  mode: "simulated" | "live";
  reason?: string | null;
  designNumber?: string;
};

export function DesignSuccessReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useDesignSuccessReport(year, month, enabled);
  const erpStatusQuery = useErpIntegrationStatus(enabled);
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [lastSync, setLastSync] = useState<DesignSuccessSyncResult | null>(null);
  const [form, setForm] = useState({
    designId: "",
    productionQty: "",
    salesQty: "",
    salesValue: "",
    marginPercent: "",
  });

  const upsert = useMutation({
    mutationFn: () =>
      apiPost("/api/reports/design-success", {
        designId: form.designId,
        periodYear: year,
        periodMonth: month,
        productionQty: form.productionQty ? Number(form.productionQty) : undefined,
        salesQty: form.salesQty ? Number(form.salesQty) : undefined,
        salesValue: form.salesValue ? Number(form.salesValue) : undefined,
        marginPercent: form.marginPercent ? Number(form.marginPercent) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.designSuccess(year, month) });
      toast.success("Design success metric saved");
      setUpsertOpen(false);
      setForm({ designId: "", productionQty: "", salesQty: "", salesValue: "", marginPercent: "" });
    },
    onError: (e) => toast.errorFromApi(e, "Could not save metric"),
  });

  const erpSync = useMutation({
    mutationFn: (designId: string) =>
      apiPost<DesignSuccessSyncResult>("/api/reports/design-success/sync", { designId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.designSuccess(year, month) });
      setLastSync(data);
      if (data.ingested) {
        toast.success(
          "ERP metrics ingested",
          data.designNumber ? `Updated metrics for ${data.designNumber}` : undefined,
        );
      } else if (data.mode === "simulated") {
        toast.warning(
          "Simulated ERP mode",
          data.reason ?? "Configure ERP_API_BASE_URL to ingest live design-success metrics.",
        );
      } else {
        toast.info("No ERP metrics", data.reason ?? "Live ERP returned no data for this design.");
      }
    },
    onError: (e) => toast.errorFromApi(e, "ERP sync failed"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const rows = reportQuery.data ?? [];
  const totalSales = rows.reduce((sum, row) => sum + Number(row.salesValue ?? 0), 0);
  const erpMode = erpStatusQuery.data?.mode ?? lastSync?.mode ?? "simulated";

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Design Success Report"
        subtitle="Production quantity, sales, and margin by design (manual or ERP-fed)"
        actions={
          <>
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={erpSync.isPending}
              onClick={() => {
                const designId = form.designId || rows[0]?.designId;
                if (!designId) {
                  toast.error("Select a design", "Enter a design ID or load a row first.");
                  return;
                }
                erpSync.mutate(String(designId));
              }}
            >
              {erpSync.isPending ? "Syncing…" : "Sync from ERP"}
            </AppButton>
            <AppButton type="button" appVariant="primary" size="sm" onClick={() => setUpsertOpen(true)}>
              Add / Update Metric
            </AppButton>
          </>
        }
      />

      <AppCard title="ERP feed" className="stack-section">
        <p className="mb-2 text-sm">
          Mode:{" "}
          <StatusBadge
            status={erpMode === "live" ? "ACTIVE" : "CHECKING"}
            label={erpMode === "live" ? "Live ERP" : "Simulated"}
          />
        </p>
        <p className="m-0 text-sm text-muted-foreground">
          {erpStatusQuery.data?.message ??
            "Configure ERP_API_BASE_URL to pull production/sales/return metrics automatically."}
        </p>
        {lastSync ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Last sync: {lastSync.ingested ? "ingested" : "no data"}
            {lastSync.designNumber ? ` · ${lastSync.designNumber}` : ""}
            {lastSync.reason ? ` — ${lastSync.reason}` : ""}
          </p>
        ) : null}
      </AppCard>

      <div className="toolbar stack-section">
        <FormTextField
          id="dsYear"
          label="Year"
          type="number"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value) || year)}
        />
        <FormTextField
          id="dsMonth"
          label="Month"
          type="number"
          min={1}
          max={12}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value) || month)}
        />
      </div>

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Designs tracked" value={rows.length} />
          <StatCard label="Total sales value" value={`₹${totalSales.toLocaleString()}`} />
        </div>

        <DataTable
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) =>
                row.design
                  ? `${row.design.ideaRef} — ${row.design.collectionName}`
                  : row.designId,
            },
            {
              key: "productType",
              header: "Product",
              render: (row) => row.design?.productType?.name ?? "—",
            },
            { key: "productionQty", header: "Prod Qty", align: "right" },
            { key: "salesQty", header: "Sales Qty", align: "right" },
            {
              key: "salesValue",
              header: "Sales Value",
              align: "right",
              render: (row) =>
                row.salesValue != null ? `₹${Number(row.salesValue).toLocaleString()}` : "—",
            },
            {
              key: "marginPercent",
              header: "Margin %",
              align: "right",
              render: (row) => (row.marginPercent != null ? `${row.marginPercent}%` : "—"),
            },
            {
              key: "sync",
              header: "",
              align: "right",
              render: (row) => (
                <AppButton
                  type="button"
                  appVariant="ghost"
                  size="sm"
                  disabled={erpSync.isPending}
                  onClick={() => erpSync.mutate(String(row.designId))}
                >
                  Sync
                </AppButton>
              ),
            },
          ]}
          rows={rows}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No design success metrics for this period"
          emptyDescription="Add metrics manually or sync from live ERP when ERP_API_BASE_URL is configured."
        />
      </QueryState>

      <Modal
        open={upsertOpen}
        title="Upsert design success metric"
        onClose={() => setUpsertOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setUpsertOpen(false)}>
              Cancel
            </AppButton>
            <AppButton disabled={!form.designId || upsert.isPending} onClick={() => upsert.mutate()}>
              Save
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField
            id="dsDesignId"
            label="Design ID"
            required
            value={form.designId}
            onChange={(e) => setForm({ ...form, designId: e.target.value })}
          />
          <ModalFormGrid>
            <FormTextField
              id="dsProdQty"
              label="Production Qty"
              type="number"
              value={form.productionQty}
              onChange={(e) => setForm({ ...form, productionQty: e.target.value })}
            />
            <FormTextField
              id="dsSalesQty"
              label="Sales Qty"
              type="number"
              value={form.salesQty}
              onChange={(e) => setForm({ ...form, salesQty: e.target.value })}
            />
          </ModalFormGrid>
          <ModalFormGrid>
            <FormTextField
              id="dsSalesValue"
              label="Sales Value"
              type="number"
              value={form.salesValue}
              onChange={(e) => setForm({ ...form, salesValue: e.target.value })}
            />
            <FormTextField
              id="dsMargin"
              label="Margin %"
              type="number"
              value={form.marginPercent}
              onChange={(e) => setForm({ ...form, marginPercent: e.target.value })}
            />
          </ModalFormGrid>
        </ModalForm>
      </Modal>
    </div>
  );
}
