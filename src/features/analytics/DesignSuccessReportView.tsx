"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { AppCard } from "@/components/ui/AppCard";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignSuccessReport, type DesignSuccessMetricRow } from "@/hooks/use-reports";
import { useErpIntegrationStatus } from "@/hooks/use-production";
import { useClientList } from "@/hooks/use-client-list";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { ListPeriodFilter } from "@/components/ui/ListPeriodFilter";
import { AppButton } from "@/components/ui/AppButton";
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import {
  erpGoLiveChecklistItems,
  erpModeDisplayLabel,
} from "@/lib/services/erp-integration-config";

type DesignSuccessSyncResult = {
  ingested: boolean;
  mode: "simulated" | "live";
  reason?: string | null;
  designNumber?: string;
};

type DesignSuccessBatchSyncResult = {
  mode: "simulated" | "live";
  scanned: number;
  ingested: number;
  skipped: number;
  failed: number;
  errors: Array<{ designId: string; designNumber: string; reason: string }>;
};

function metricSearchText(row: DesignSuccessMetricRow) {
  const design = row.design;
  return `${design?.ideaRef ?? ""} ${design?.collectionName ?? ""} ${design?.productType?.name ?? ""} ${row.designId}`;
}

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
  const [lastBatchSync, setLastBatchSync] = useState<DesignSuccessBatchSyncResult | null>(null);
  const [form, setForm] = useState({
    designId: "",
    productionQty: "",
    salesQty: "",
    salesValue: "",
    returnQty: "",
    marginPercent: "",
    repeatOrders: "",
  });

  const rows = reportQuery.data ?? [];
  const getSearchText = useCallback(metricSearchText, []);
  const list = useClientList({
    items: rows,
    getSearchText,
    filterKey: `${year}-${month}`,
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
        returnQty: form.returnQty ? Number(form.returnQty) : undefined,
        marginPercent: form.marginPercent ? Number(form.marginPercent) : undefined,
        repeatOrders: form.repeatOrders ? Number(form.repeatOrders) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.designSuccess(year, month) });
      toast.success("Design success metric saved");
      setUpsertOpen(false);
      setForm({
        designId: "",
        productionQty: "",
        salesQty: "",
        salesValue: "",
        returnQty: "",
        marginPercent: "",
        repeatOrders: "",
      });
    },
    onError: (e) => toast.errorFromApi(e, "Could not save metric"),
  });

  const erpSync = useMutation({
    mutationFn: (designId: string) =>
      apiPost<DesignSuccessSyncResult>("/api/reports/design-success/sync", {
        designId,
        periodYear: year,
        periodMonth: month,
      }),
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

  const batchErpSync = useMutation({
    mutationFn: () =>
      apiPost<DesignSuccessBatchSyncResult>("/api/reports/design-success/sync-all", {
        periodYear: year,
        periodMonth: month,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.designSuccess(year, month) });
      setLastBatchSync(data);
      if (data.mode === "simulated") {
        toast.warning(
          "Simulated ERP mode",
          data.errors[0]?.reason ?? "Configure ERP_API_BASE_URL for batch sync.",
        );
        return;
      }
      toast.success(
        "Batch ERP sync finished",
        `Ingested ${data.ingested} of ${data.scanned} (skipped ${data.skipped}, failed ${data.failed})`,
      );
    },
    onError: (e) => toast.errorFromApi(e, "Batch ERP sync failed"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const totalSales = rows.reduce((sum, row) => sum + Number(row.salesValue ?? 0), 0);
  const erpMode = erpStatusQuery.data?.mode ?? lastSync?.mode ?? "simulated";
  const isSimulated = erpMode === "simulated";
  const goLiveItems = erpGoLiveChecklistItems();

  return (
    <ListPage
      title="Design Success Report"
        subtitle={
          isSimulated
            ? "Simulated ERP - complete in-app stages at /production/erp to auto-fill metrics, or enter them manually. Partner Sync needs ERP_API_BASE_URL."
            : "Live ERP feed - sync partner metrics or adjust rows manually."
        }
        wide
        actions={
          <>
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={batchErpSync.isPending || isSimulated}
              title={
                isSimulated
                  ? "Unavailable until ERP_API_BASE_URL is configured"
                  : "Pull success metrics for all released/live designs"
              }
              onClick={() => batchErpSync.mutate()}
            >
              {isSimulated
                ? "Batch sync unavailable"
                : batchErpSync.isPending
                  ? "Batch syncing…"
                  : "Sync all from ERP"}
            </AppButton>
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={erpSync.isPending || isSimulated}
              title={
                isSimulated
                  ? "Unavailable until ERP_API_BASE_URL is configured"
                  : "Pull success metrics from partner ERP"
              }
              onClick={() => {
                const designId = form.designId || rows[0]?.designId;
                if (!designId) {
                  toast.error("Select a design", "Enter a design ID or load a row first.");
                  return;
                }
                erpSync.mutate(String(designId));
              }}
            >
              {isSimulated
                ? "Sync unavailable (simulated)"
                : erpSync.isPending
                  ? "Syncing…"
                  : "Sync from ERP"}
            </AppButton>
            <AppButton type="button" appVariant="primary" size="sm" onClick={() => setUpsertOpen(true)}>
              {isSimulated ? "Enter metric (manual)" : "Add / Update Metric"}
            </AppButton>
          </>
        }
        filters={
          <ListPeriodFilter
            yearId="dsYear"
            monthId="dsMonth"
            year={year}
            month={month}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />
        }
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: "Search designs…",
          "aria-label": "Search design success metrics",
        }}
        onRefresh={() => {
          void reportQuery.refetch();
          void erpStatusQuery.refetch();
        }}
        isRefreshing={reportQuery.isFetching || erpStatusQuery.isFetching}
        beforeTable={
          <>
            <AppCard title="ERP feed">
              <p className="mb-2 text-sm">
                Mode:{" "}
                <StatusBadge
                  status={erpMode === "live" ? "ACTIVE" : "CHECKING"}
                  label={erpModeDisplayLabel(erpMode)}
                />
              </p>
              <p className="m-0 text-sm text-muted-foreground">
                {erpStatusQuery.data?.message ??
                  (isSimulated
                    ? "ERP_API_BASE_URL is unset - partner ingest is simulated. In-app ERP stages still update design-success on complete; manual entry stays fully usable."
                    : "Live partner feed is active.")}
              </p>
              {isSimulated ? (
                <div className="erp-golive-callout mt-3">
                  <p className="erp-golive-callout__title">Go-live checklist</p>
                  <ul className="erp-golive-callout__list">
                    {goLiveItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lastSync ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last single sync: {lastSync.ingested ? "ingested" : "no data"}
                  {lastSync.designNumber ? ` · ${lastSync.designNumber}` : ""}
                  {lastSync.reason ? ` - ${lastSync.reason}` : ""}
                </p>
              ) : null}
              {lastBatchSync ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last batch sync ({lastBatchSync.mode}): scanned {lastBatchSync.scanned}, ingested{" "}
                  {lastBatchSync.ingested}, skipped {lastBatchSync.skipped}, failed{" "}
                  {lastBatchSync.failed}
                  {lastBatchSync.errors[0]?.reason
                    ? ` - ${lastBatchSync.errors[0].reason}`
                    : ""}
                </p>
              ) : null}
              {!isSimulated ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Worker also runs an hourly auto batch sync when Redis + notification worker are up.
                </p>
              ) : null}
            </AppCard>
            {!reportQuery.isLoading ? (
              <div className="stat-grid">
                <StatCard label="Designs tracked" value={rows.length} />
                <StatCard label="Total sales value" value={`₹${totalSales.toLocaleString()}`} />
              </div>
            ) : null}
          </>
        }
        query={{
          isLoading: reportQuery.isLoading,
          isError: reportQuery.isError,
          error: reportQuery.error,
          onRetry: () => reportQuery.refetch(),
          skeletonVariant: "table",
        }}
        pagination={{
          total: list.total,
          page: list.page,
          pageSize: list.pageSize,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
          pageSizeSelectId: "design-success-page-size",
        }}
        overlays={
          <Modal
            open={upsertOpen}
            title={isSimulated ? "Manual metric entry (simulated ERP)" : "Upsert design success metric"}
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
              {isSimulated ? (
                <p className="m-0 mb-3 text-sm text-muted-foreground">
                  Partner ERP ingest is offline. Enter production/sales figures here - they are stored
                  in-app and remain valid after you go live.
                </p>
              ) : null}
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
                  id="dsReturnQty"
                  label="Return Qty"
                  type="number"
                  value={form.returnQty}
                  onChange={(e) => setForm({ ...form, returnQty: e.target.value })}
                />
              </ModalFormGrid>
              <ModalFormGrid>
                <FormTextField
                  id="dsMargin"
                  label="Margin %"
                  type="number"
                  value={form.marginPercent}
                  onChange={(e) => setForm({ ...form, marginPercent: e.target.value })}
                />
                <FormTextField
                  id="dsRepeat"
                  label="Repeat Orders"
                  type="number"
                  value={form.repeatOrders}
                  onChange={(e) => setForm({ ...form, repeatOrders: e.target.value })}
                />
              </ModalFormGrid>
            </ModalForm>
          </Modal>
        }
      >
        <DataTable
          flush
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) =>
                row.design
                  ? `${row.design.ideaRef} - ${row.design.collectionName}`
                  : row.designId,
            },
            {
              key: "productType",
              header: "Product",
              render: (row) => row.design?.productType?.name ?? "-",
            },
            { key: "productionQty", header: "Prod Qty", align: "right" },
            { key: "salesQty", header: "Sales Qty", align: "right" },
            {
              key: "salesValue",
              header: "Sales Value",
              align: "right",
              render: (row) =>
                row.salesValue != null ? `₹${Number(row.salesValue).toLocaleString()}` : "-",
            },
            {
              key: "returnQty",
              header: "Return Qty",
              align: "right",
              render: (row) => (row.returnQty != null ? String(row.returnQty) : "-"),
            },
            {
              key: "marginPercent",
              header: "Margin %",
              align: "right",
              render: (row) => (row.marginPercent != null ? `${row.marginPercent}%` : "-"),
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
                  disabled={erpSync.isPending || isSimulated}
                  title={
                    isSimulated
                      ? "Unavailable until ERP_API_BASE_URL is configured"
                      : undefined
                  }
                  onClick={() => erpSync.mutate(String(row.designId))}
                >
                  Sync
                </AppButton>
              ),
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No design success metrics for this period"
          emptyDescription={
            isSimulated
              ? "Use Enter metric (manual) while ERP is simulated, or configure ERP_API_BASE_URL and sync."
              : "Add metrics manually or sync from live ERP."
          }
        />
    </ListPage>
  );
}
