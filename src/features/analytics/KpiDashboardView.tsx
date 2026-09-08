"use client";

import { useEffect, useMemo, useState } from "react";
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function scoreTone(score: number): "high" | "mid" | "low" {
  if (score >= 85) return "high";
  if (score >= 70) return "mid";
  return "low";
}

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

  const items = kpiQuery.data?.items ?? [];
  const summary = kpiQuery.data?.summary;
  const chartData = summary?.chart ?? [];

  const teamScore = useMemo(() => {
    if (!chartData.length) return null;
    const avg = chartData.reduce((sum, row) => sum + row.score, 0) / chartData.length;
    return Math.round(avg * 10) / 10;
  }, [chartData]);

  const metricAverages = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const row of items) {
      const score = Number(row.score);
      if (!Number.isFinite(score)) continue;
      const current = buckets.get(row.metricCode) ?? { sum: 0, count: 0 };
      current.sum += score;
      current.count += 1;
      buckets.set(row.metricCode, current);
    }
    return SPEC_KPI_METRICS.map((metric) => {
      const bucket = buckets.get(metric.code);
      const avg = bucket && bucket.count > 0 ? bucket.sum / bucket.count : null;
      return {
        ...metric,
        avg,
        scored: summary?.metricCounts[metric.code] ?? 0,
      };
    });
  }, [items, summary?.metricCounts]);

  const highlightMetrics = useMemo(() => {
    const findAvg = (code: string) =>
      metricAverages.find((m) => m.code === code)?.avg ?? null;
    return {
      onTime: findAvg("ON_TIME_COMPLETION"),
      firstTime: findAvg("FIRST_TIME_RIGHT"),
      quality: findAvg("QUALITY_APPROVAL"),
    };
  }, [metricAverages]);

  const scorecard = useMemo(
    () =>
      [...chartData]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((row) => ({
          ...row,
          tone: scoreTone(row.score),
        })),
    [chartData],
  );

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
        title="KRA / KPI Performance"
        subtitle="Employee productivity, quality and rating across the design pipeline"
        actions={
          <>
            <AppButtonLink
              href={`${ROUTES.admin.masters}?tab=kpi`}
              appVariant="secondary"
              size="sm"
            >
              Configure KPI
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
              {recompute.isPending ? "Recalculating…" : "Recalculate Scores"}
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
        <div className="stat-grid">
          <StatCard
            label="Team Score"
            value={teamScore != null ? String(teamScore) : "—"}
            trend={`${summary?.employeeCount ?? 0} employees scored`}
            tone="accent"
          />
          <StatCard
            label="On-time Completion"
            value={
              highlightMetrics.onTime != null
                ? `${Math.round(highlightMetrics.onTime)}%`
                : "—"
            }
            trend={`Weight ${SPEC_KPI_METRICS.find((m) => m.code === "ON_TIME_COMPLETION")?.weight}%`}
          />
          <StatCard
            label="First-time Right"
            value={
              highlightMetrics.firstTime != null
                ? `${Math.round(highlightMetrics.firstTime)}%`
                : "—"
            }
            trend={`Weight ${SPEC_KPI_METRICS.find((m) => m.code === "FIRST_TIME_RIGHT")?.weight}%`}
          />
          <StatCard
            label="Quality Approval"
            value={
              highlightMetrics.quality != null
                ? `${Math.round(highlightMetrics.quality)}%`
                : "—"
            }
            trend={`${summary?.scoreRecordCount ?? 0} score records`}
            tone="success"
          />
        </div>

        <div className="panel-grid-2">
          <AppCard title="Employee Scorecard" description="Top weighted scores this period">
            {scorecard.length > 0 ? (
              <ul className="employee-score-list">
                {scorecard.map((row) => (
                  <li key={row.employeeId} className="employee-score-row">
                    <span className="employee-score-avatar" aria-hidden>
                      {initials(row.name)}
                    </span>
                    <div className="employee-score-meta">
                      <p className="employee-score-name">{row.name}</p>
                      <p className="employee-score-sub">Weighted composite</p>
                    </div>
                    <span
                      className={`employee-score-value employee-score-value--${row.tone}`}
                    >
                      {Math.round(row.score * 10) / 10} / 100
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                No employee scores yet. Recalculate to populate the scorecard.
              </p>
            )}
          </AppCard>

          <AppCard title="KPI Achievement" description="Average score by metric">
            <ul className="kpi-metric-list">
              {metricAverages.map((metric) => {
                const pct = metric.avg != null ? Math.min(100, Math.max(0, metric.avg)) : 0;
                return (
                  <li key={metric.code} className="kpi-metric-row">
                    <div className="kpi-metric-head">
                      <span>{metric.label}</span>
                      <span className="text-muted-foreground">
                        {metric.avg != null ? `${Math.round(metric.avg)}%` : "—"}
                        <span className="opacity-70"> · wt {metric.weight}%</span>
                      </span>
                    </div>
                    <div className="kpi-metric-track" aria-hidden>
                      <div className="kpi-metric-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </AppCard>
        </div>

        {chartData.length > 0 ? (
          <AppCard className="kpi-chart-card" title="Monthly performance" description="Weighted score by employee">
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

        <AppCard title="KPI Actions" flat>
          <div className="kpi-actions-row">
            <AppButtonLink href={`${ROUTES.admin.masters}?tab=kpi`} appVariant="outline" size="sm">
              Edit KPI Weightage
            </AppButtonLink>
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              disabled={recompute.isPending}
              onClick={() => recompute.mutate()}
            >
              Recalculate Scores
            </AppButton>
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="outline" size="sm">
              Open Detailed Report
            </AppButtonLink>
          </div>
        </AppCard>

        <AppCard title="Score detail" flush>
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
            emptyDescription="Click Recalculate Scores."
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
      </QueryState>
    </div>
  );
}
