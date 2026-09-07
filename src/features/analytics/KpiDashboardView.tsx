"use client";

import { useEffect, useState } from "react";
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
import { PaginationBar } from "@/components/ui/PaginationBar";
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
  employee: { id: number; name: string; employeeCode: string };
};

type KpiEmployeesResponse = {
  items: KpiRow[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    scoreRecordCount: number;
    employeeCount: number;
    chart: { employeeId: number; name: string; score: number }[];
    metricCounts: Record<string, number>;
  };
};

const DEFAULT_PAGE_SIZE = 25;

export function KpiDashboardView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpi.employees(page, pageSize),
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      return apiGet<KpiEmployeesResponse>(`/api/kpi/employees?${params}`);
    },
    enabled,
    placeholderData: (previous) => previous,
  });
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const recompute = useMutation({
    mutationFn: () => apiPost<{ count: number }>("/api/kpi/recompute", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.employeesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.designHead });
      setPage(1);
      toast.success("KPI recomputed", `${data.count} score records updated`);
    },
    onError: (error) => toast.errorFromApi(error, "Recompute failed"),
  });

  const total = kpiQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const items = kpiQuery.data?.items ?? [];
  const summary = kpiQuery.data?.summary;
  const chartData = summary?.chart ?? [];
  const metricCoverage = SPEC_KPI_METRICS.map((metric) => ({
    ...metric,
    scored: summary?.metricCounts[metric.code] ?? 0,
  }));

  return (
    <div className="page-shell">
      <PageHeader
        title="Performance KPI"
        actions={
          <>
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
              Reports
            </AppButtonLink>
            <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">
              Employees
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
              Recompute
            </AppButton>
          </>
        }
      />

      <QueryState
        isLoading={kpiQuery.isLoading}
        isError={kpiQuery.isError}
        error={kpiQuery.error}
        onRetry={() => kpiQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Score records" value={summary?.scoreRecordCount ?? 0} />
          <StatCard label="Employees" value={summary?.employeeCount ?? 0} />
          <StatCard label="Metrics" value={SPEC_KPI_METRICS.length} />
          <StatCard
            label="Period"
            value={new Date().toLocaleString("en", { month: "short", year: "numeric" })}
          />
        </div>

        {chartData.length > 0 ? (
          <AppCard className="stack-section kpi-chart-card" title="Weighted score">
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
        ) : null}

        <AppCard title="Score detail" className="stack-section" flush>
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
            rows={items}
            getRowKey={(row) => row.id}
            emptyTitle="No KPI scores"
            emptyDescription="Click Recompute."
          />
          <PaginationBar
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </AppCard>

        <AppCard title="Metric weights" className="stack-section" flat>
          <ul className="m-0 columns-2 list-none space-y-1 p-0 text-sm leading-relaxed">
            {metricCoverage.map((metric) => (
              <li key={metric.code} className="flex justify-between gap-2 border-b border-border/50 py-1">
                <span>{metric.label}</span>
                <span className="text-muted-foreground">
                  {metric.weight}%
                  {metric.scored > 0 ? ` · ${metric.scored}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </AppCard>
      </QueryState>
    </div>
  );
}
