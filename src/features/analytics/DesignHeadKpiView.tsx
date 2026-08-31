"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
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

export function DesignHeadKpiView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpi.designHead,
    queryFn: () => apiGet<KpiRow[]>("/api/kpi/design-head"),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Design Head KPI"
        subtitle="Team leadership performance rollup"
      />
      <QueryState
        isLoading={kpiQuery.isLoading}
        isError={kpiQuery.isError}
        error={kpiQuery.error}
        onRetry={() => kpiQuery.refetch()}
      >
        <div className="card">
          <DataTable
            columns={[
              { key: "employee", header: "Design Head", render: (r) => r.employee.name },
              { key: "metricCode", header: "Metric" },
              {
                key: "period",
                header: "Period",
                render: (r) => `${r.periodMonth}/${r.periodYear}`,
              },
              { key: "score", header: "Score", align: "right" },
              { key: "weightedScore", header: "Weighted", align: "right" },
            ]}
            rows={kpiQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No design head KPI data"
            emptyDescription="Run KPI recompute from the admin KPI dashboard."
          />
        </div>
      </QueryState>
    </div>
  );
}
