"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormTextField } from "@/components/ui/form-text-field";
import { PERMISSIONS } from "@/lib/permissions";
import { useProductionStartReport } from "@/hooks/use-reports";

export function ProductionStartReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useProductionStartReport(year, month, enabled);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const report = reportQuery.data;
  const byProductType = report?.byProductType ?? [];
  const designs = report?.designs ?? [];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Production Start Report"
        subtitle="Designs that reached production accepted or released in the selected month."
      />

      <div className="toolbar stack-section">
        <FormTextField
          id="psYear"
          label="Year"
          type="number"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value) || year)}
        />
        <FormTextField
          id="psMonth"
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
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Production starts" value={report?.total ?? 0} />
          <StatCard label="Product types" value={byProductType.length} />
        </div>

        <AppCard className="stack-section" title="By product type">
          <ul className="detail-task-list">
            {byProductType.length === 0 ? (
              <li>
                <span className="text-muted-foreground">No starts this period</span>
                <strong>0</strong>
              </li>
            ) : (
              byProductType.map((row) => (
                <li key={row.code}>
                  <span>{row.name}</span>
                  <strong>{row.count}</strong>
                </li>
              ))
            )}
          </ul>
        </AppCard>

        <DataTable
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) =>
                `${row.ideaRef}${row.designNumber ? ` · ${row.designNumber}` : ""} - ${row.collectionName}`,
            },
            {
              key: "product",
              header: "Product",
              render: (row) => row.productType?.name ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
          rows={designs}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No production starts for this period"
          emptyDescription="Designs accepted or released to production in this month appear here."
        />
      </QueryState>
    </div>
  );
}
