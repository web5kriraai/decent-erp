"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/config/routes";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";

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
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const recompute = useMutation({
    mutationFn: () => apiPost<{ count: number }>("/api/kpi/recompute", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.designHead });
      toast.success("KPI recomputed", `${data.count} score records updated`);
    },
    onError: (error) => toast.errorFromApi(error, "Recompute failed"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const data = kpiQuery.data ?? [];
  const chartData = Object.values(
    data.reduce<Record<string, { name: string; score: number }>>((acc, row) => {
      const key = row.employee.employeeCode;
      if (!acc[key]) acc[key] = { name: row.employee.name.split(" ")[0], score: 0 };
      acc[key].score += Number(row.weightedScore);
      return acc;
    }, {}),
  );

  const metricCoverage = SPEC_KPI_METRICS.map((metric) => ({
    ...metric,
    scored: data.filter((row) => row.metricCode === metric.code).length,
  }));

  return (
    <div className="page-shell">
      <PageHeader
        title="Performance KPI"
        subtitle="Nine weighted metrics (spec §9.1) across roles and period"
        actions={
          <>
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
              Reports Hub
            </AppButtonLink>
            <AppButtonLink href={ROUTES.analytics.kpiDesignHead} appVariant="secondary" size="sm">
              Design Head
            </AppButtonLink>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={recompute.isPending}
              onClick={() => recompute.mutate()}
            >
              Recompute KPI
            </AppButton>
          </>
        }
      />

      <AppCard className="stack-section" title="Metric definitions (weights = 100%)">
        <ul className="m-0 columns-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {metricCoverage.map((metric) => (
            <li key={metric.code}>
              <strong>{metric.label}</strong> — {metric.weight}%
              {metric.scored > 0 ? ` (${metric.scored} scores)` : ""}
            </li>
          ))}
        </ul>
      </AppCard>

      <QueryState
        isLoading={kpiQuery.isLoading}
        isError={kpiQuery.isError}
        error={kpiQuery.error}
        onRetry={() => kpiQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Score Records" value={data.length} accent />
          <StatCard
            label="Employees Tracked"
            value={new Set(data.map((d) => d.employee.employeeCode)).size}
          />
          <StatCard label="Metrics" value={SPEC_KPI_METRICS.length} />
          <StatCard
            label="Current Period"
            value={new Date().toLocaleString("en", { month: "short", year: "numeric" })}
          />
        </div>

        {chartData.length > 0 && (
          <AppCard className="stack-section kpi-chart-card" title="Weighted score by employee">
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AppCard>
        )}

        <DataTable<KpiRow & Record<string, unknown>>
          columns={[
            { key: "employee", header: "Employee", render: (r) => r.employee.name },
            {
              key: "metricCode",
              header: "Metric",
              render: (r) =>
                SPEC_KPI_METRICS.find((m) => m.code === r.metricCode)?.label ?? r.metricCode,
            },
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
          emptyDescription="Click Recompute KPI to calculate all nine weighted metrics from task and correction history."
        />
      </QueryState>
    </div>
  );
}
