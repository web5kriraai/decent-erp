"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type MaterialReport = {
  total: number;
  byStatus: Record<string, number>;
  byMasterType: Record<string, number>;
  lines: Array<{
    id: string;
    ideaRef: string;
    collectionName: string;
    designId: string;
    itemType: string;
    itemName: string;
    quantity: number;
    unit: string;
    source: string;
    status: string;
  }>;
};

export function MaterialAnalysisReportView() {
  const { data: session } = useSession();
  const enabled = (session?.user?.permissions ?? []).includes(PERMISSIONS.KPI_ADMIN);
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.material,
    queryFn: () => apiGet<MaterialReport>("/api/reports/material"),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Material Analysis"
        subtitle="Material lines by type, source, and issue status."
        actions={
          <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
            Reports Hub
          </AppButtonLink>
        }
      />
      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Lines" value={report?.total ?? 0} />
          {Object.entries(report?.byStatus ?? {})
            .slice(0, 4)
            .map(([status, count]) => (
              <StatCard key={status} label={status.replace(/_/g, " ")} value={count} />
            ))}
        </div>
        <DataTable
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) => (
                <Link href={ROUTES.designs.detail(row.designId)} className="data-table-link">
                  {row.ideaRef}
                </Link>
              ),
            },
            { key: "itemType", header: "Type", render: (r) => r.itemType.replace(/_/g, " ") },
            { key: "itemName", header: "Item" },
            {
              key: "qty",
              header: "Qty",
              render: (r) => `${r.quantity} ${r.unit}`,
            },
            { key: "source", header: "Source" },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
          rows={report?.lines ?? []}
          getRowKey={(r) => r.id}
          emptyTitle="No material lines"
        />
      </QueryState>
    </div>
  );
}
