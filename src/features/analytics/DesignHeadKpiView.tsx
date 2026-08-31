"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type TeamScoreRow = {
  id: string;
  metricCode: string;
  score: string;
  weightedScore: string;
  periodYear: number;
  periodMonth: number;
  employee: { name: string; employeeCode: string };
};

type DesignHeadKpiResponse = {
  periodYear: number;
  periodMonth: number;
  ideasCreated: number;
  approvedCount: number;
  releasedCount: number;
  liveCount: number;
  conversionPercent: number;
  teamScores: TeamScoreRow[];
};

export function DesignHeadKpiView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpi.designHead,
    queryFn: () => apiGet<DesignHeadKpiResponse>("/api/kpi/design-head"),
    enabled,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const data = kpiQuery.data;
  const periodLabel = data
    ? `${data.periodMonth}/${data.periodYear}`
    : new Date().toLocaleString("en", { month: "short", year: "numeric" });

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
        skeletonVariant="stats"
      >
        {data && (
          <>
            <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
              <StatCard label="Ideas Created" value={data.ideasCreated} accent />
              <StatCard label="Approved" value={data.approvedCount} />
              <StatCard label="Released" value={data.releasedCount} />
              <StatCard label="Live" value={data.liveCount} />
              <StatCard
                label="Conversion"
                value={`${data.conversionPercent}%`}
                trend={`Period ${periodLabel}`}
              />
            </div>

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
                rows={data.teamScores}
                getRowKey={(r) => r.id}
                emptyTitle="No design head KPI data"
                emptyDescription="Run KPI recompute from the admin KPI dashboard."
              />
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
