"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type KpiRow = {
  id: string;
  metricCode: string;
  score: string;
  weightedScore: string;
  periodYear: number;
  periodMonth: number;
  employee: { name: string; employeeCode: string };
};

export function KpiDashboardView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpi.employees,
    queryFn: () => apiGet<KpiRow[]>("/api/kpi/employees"),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const data = kpiQuery.data ?? [];

  return (
    <div className="page-shell">
      <PageHeader
        title="Performance KPI"
        subtitle="Weighted employee scores by role and period"
      />

      <QueryState
        isLoading={kpiQuery.isLoading}
        isError={kpiQuery.isError}
        error={kpiQuery.error}
        onRetry={() => kpiQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <StatCard label="Score Records" value={data.length} accent />
          <StatCard
            label="Employees Tracked"
            value={new Set(data.map((d) => d.employee.employeeCode)).size}
          />
          <StatCard
            label="Current Period"
            value={new Date().toLocaleString("en", { month: "short", year: "numeric" })}
          />
        </div>

        <DataTable<KpiRow & Record<string, unknown>>
          columns={[
            { key: "employee", header: "Employee", render: (r) => r.employee.name },
            { key: "metricCode", header: "Metric" },
            {
              key: "period",
              header: "Period",
              render: (r) => `${r.periodMonth}/${r.periodYear}`,
            },
            { key: "score", header: "Score", align: "right" },
            { key: "weightedScore", header: "Weighted", align: "right" },
          ]}
          rows={data}
          getRowKey={(row) => row.id}
          emptyTitle="No KPI scores yet"
          emptyDescription="Scores are calculated from task time events and role-weighted definitions."
        />
      </QueryState>
    </div>
  );
}
