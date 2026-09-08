"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { FormTextField } from "@/components/ui/form-text-field";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type RankingReport = {
  periodYear: number;
  periodMonth: number;
  total: number;
  rankings: Array<{
    rank: number;
    employeeId: number;
    name: string;
    code: string;
    weightedScore: number;
    metricCount: number;
  }>;
};

export function DesignerRankingReportView() {
  const { data: session } = useSession();
  const enabled = (session?.user?.permissions ?? []).includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.designerRanking(year, month),
    queryFn: () =>
      apiGet<RankingReport>(
        `/api/reports/designer-ranking?year=${year}&month=${month}`,
      ),
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
  const top = report?.rankings[0];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Designer Ranking"
        subtitle="Weighted KPI score ranking for the selected month."
        actions={
          <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
            Reports Hub
          </AppButtonLink>
        }
      />
      <PageToolbar panel className="stack-section">
        <FormTextField
          id="rankYear"
          label="Year"
          type="number"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value) || year)}
        />
        <FormTextField
          id="rankMonth"
          label="Month"
          type="number"
          min={1}
          max={12}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value) || month)}
        />
      </PageToolbar>
      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Ranked employees" value={report?.total ?? 0} />
          <StatCard
            label="Top score"
            value={top ? top.weightedScore.toFixed(1) : "—"}
            trend={top?.name}
            tone="accent"
          />
        </div>
        <DataTable
          columns={[
            { key: "rank", header: "Rank" },
            { key: "name", header: "Employee" },
            { key: "code", header: "Code" },
            {
              key: "weightedScore",
              header: "Weighted score",
              render: (r) => r.weightedScore.toFixed(2),
            },
            { key: "metricCount", header: "Metrics" },
          ]}
          rows={report?.rankings ?? []}
          getRowKey={(r) => String(r.employeeId)}
          emptyTitle="No KPI scores for this period"
          emptyDescription="Run monthly KPI recompute, then refresh."
        />
      </QueryState>
    </div>
  );
}
