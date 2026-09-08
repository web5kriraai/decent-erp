"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/config/routes";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";
import { cn } from "@/lib/utils";

type KpiRow = {
  id: string;
  metricCode: string;
  score: string;
  weightedScore: string;
  periodYear: number;
  periodMonth: number;
  employee: { id: number; name: string; employeeCode: string };
};

type KpiChartRow = {
  employeeId: number;
  name: string;
  score: number;
  gradeCode?: string | null;
  marksBalance?: number | null;
};

type KpiEmployeesResponse = {
  items: KpiRow[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    scoreRecordCount: number;
    employeeCount: number;
    chart: KpiChartRow[];
    metricCounts: Record<string, number>;
    metricAverages?: Record<string, number | null>;
  };
};

function gradeBadgeTone(code: string): string {
  switch (code) {
    case "A":
      return "APPROVED";
    case "B":
      return "COMPLETED";
    case "C":
      return "ASSIGNED";
    case "D":
      return "ON_HOLD";
    default:
      return "REJECTED";
  }
}

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

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const kpiQuery = useQuery({
    queryKey: queryKeys.kpi.employees(1, 100),
    queryFn: () =>
      apiGet<KpiEmployeesResponse>(
        `/api/kpi/employees?${new URLSearchParams({ limit: "100", offset: "0" })}`,
      ),
    enabled,
  });

  const detailQuery = useQuery({
    queryKey: ["kpi", "employee-detail", selectedEmployeeId],
    queryFn: () =>
      apiGet<KpiEmployeesResponse>(
        `/api/kpi/employees?${new URLSearchParams({
          employeeId: String(selectedEmployeeId),
          limit: "50",
          offset: "0",
        })}`,
      ),
    enabled: enabled && selectedEmployeeId != null,
  });

  const queryClient = useQueryClient();
  const toast = useApiToast();
  const recompute = useMutation({
    mutationFn: () => apiPost<{ count: number }>("/api/kpi/recompute", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.employeesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.designHead });
      toast.success("KPI recomputed", `${data.count} score records updated`);
    },
    onError: (error) => toast.errorFromApi(error, "Recompute failed"),
  });

  const summary = kpiQuery.data?.summary;
  const chartData = summary?.chart ?? [];

  useEffect(() => {
    if (selectedEmployeeId != null && chartData.some((r) => r.employeeId === selectedEmployeeId)) {
      return;
    }
    if (chartData.length > 0) setSelectedEmployeeId(chartData[0].employeeId);
  }, [chartData, selectedEmployeeId]);

  const teamScore = useMemo(() => {
    if (!chartData.length) return null;
    const avg = chartData.reduce((sum, row) => sum + row.score, 0) / chartData.length;
    return Math.round(avg * 10) / 10;
  }, [chartData]);

  const metricAverages = useMemo(() => {
    return SPEC_KPI_METRICS.map((metric) => {
      const avg = summary?.metricAverages?.[metric.code] ?? null;
      return {
        ...metric,
        avg,
        scored: summary?.metricCounts[metric.code] ?? 0,
      };
    });
  }, [summary]);

  const selected = chartData.find((r) => r.employeeId === selectedEmployeeId) ?? null;
  const selectedMetrics = detailQuery.data?.items ?? [];

  const highlight = useMemo(() => {
    const findAvg = (code: string) =>
      metricAverages.find((m) => m.code === code)?.avg ?? null;
    return {
      onTime: findAvg("ON_TIME_COMPLETION"),
      firstTime: findAvg("FIRST_TIME_RIGHT"),
      quality: findAvg("QUALITY_APPROVAL"),
    };
  }, [metricAverages]);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Performance KPI"
        subtitle="Team scores and metric achievement for the current scoring period."
        actions={
          <>
            <AppButtonLink
              href={`${ROUTES.admin.masters}?tab=kpi`}
              appVariant="secondary"
              size="sm"
            >
              Configure weights
            </AppButtonLink>
            <AppButtonLink href={ROUTES.analytics.kpiDesignHead} appVariant="secondary" size="sm">
              Design Head
            </AppButtonLink>
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="outline" size="sm">
              Reports
            </AppButtonLink>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={recompute.isPending}
              onClick={() => recompute.mutate()}
            >
              {recompute.isPending ? "Recalculating…" : "Recalculate"}
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
        <div className="kpi-dash-summary">
          <div className="kpi-dash-stat kpi-dash-stat--accent">
            <p className="kpi-dash-stat-label">Team score</p>
            <p className="kpi-dash-stat-value">{teamScore != null ? teamScore : "—"}</p>
            <p className="kpi-dash-stat-meta">
              {summary?.employeeCount ?? 0} employees · {summary?.scoreRecordCount ?? 0} records
            </p>
          </div>
          <div className="kpi-dash-stat">
            <p className="kpi-dash-stat-label">On-time</p>
            <p className="kpi-dash-stat-value">
              {highlight.onTime != null ? `${Math.round(highlight.onTime)}%` : "—"}
            </p>
            <p className="kpi-dash-stat-meta">Weight 20%</p>
          </div>
          <div className="kpi-dash-stat">
            <p className="kpi-dash-stat-label">First-time right</p>
            <p className="kpi-dash-stat-value">
              {highlight.firstTime != null ? `${Math.round(highlight.firstTime)}%` : "—"}
            </p>
            <p className="kpi-dash-stat-meta">Weight 15%</p>
          </div>
          <div className="kpi-dash-stat">
            <p className="kpi-dash-stat-label">Quality</p>
            <p className="kpi-dash-stat-value">
              {highlight.quality != null ? `${Math.round(highlight.quality)}%` : "—"}
            </p>
            <p className="kpi-dash-stat-meta">Weight 20%</p>
          </div>
        </div>

        <div className="kpi-dash-layout">
          <aside className="kpi-dash-rail" aria-label="Employees">
            <p className="kpi-dash-aside-label">Scorecard</p>
            {chartData.length === 0 ? (
              <p className="kpi-dash-empty">No scores yet. Recalculate to populate.</p>
            ) : (
              <ul className="kpi-dash-employee-list">
                {chartData.map((row) => {
                  const tone = scoreTone(row.score);
                  const selectedRow = row.employeeId === selectedEmployeeId;
                  return (
                    <li key={row.employeeId}>
                      <button
                        type="button"
                        className={cn(
                          "kpi-dash-employee-btn",
                          selectedRow && "kpi-dash-employee-btn--selected",
                        )}
                        aria-pressed={selectedRow}
                        onClick={() => setSelectedEmployeeId(row.employeeId)}
                      >
                        <span className="kpi-dash-avatar" aria-hidden>
                          {initials(row.name)}
                        </span>
                        <span className="kpi-dash-employee-meta">
                          <span className="kpi-dash-employee-name">{row.name}</span>
                          <span className="kpi-dash-employee-sub">
                            {row.gradeCode ? `Grade ${row.gradeCode}` : "No grade"}
                            {row.marksBalance != null
                              ? ` · ${Math.round(row.marksBalance * 10) / 10} marks`
                              : ""}
                          </span>
                        </span>
                        <span className={`kpi-dash-score kpi-dash-score--${tone}`}>
                          {Math.round(row.score * 10) / 10}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="kpi-dash-main" aria-label="Selected employee and team metrics">
            <div className="kpi-dash-panel">
              <div className="kpi-dash-panel-head">
                <div className="min-w-0">
                  <h3 className="kpi-dash-panel-title">
                    {selected?.name ?? "Select an employee"}
                  </h3>
                  <p className="kpi-dash-panel-sub">
                    {selected
                      ? `Weighted ${Math.round(selected.score * 10) / 10} / 100`
                      : "Pick someone from the scorecard"}
                    {selected?.gradeCode ? (
                      <StatusBadge
                        className="ml-2"
                        status={gradeBadgeTone(selected.gradeCode)}
                        label={`Grade ${selected.gradeCode}`}
                      />
                    ) : null}
                  </p>
                </div>
              </div>

              {selectedEmployeeId == null ? null : detailQuery.isLoading ? (
                <p className="kpi-dash-empty">Loading metrics…</p>
              ) : selectedMetrics.length === 0 ? (
                <p className="kpi-dash-empty">No metric rows for this employee.</p>
              ) : (
                <ul className="kpi-dash-metric-list">
                  {SPEC_KPI_METRICS.map((metric) => {
                    const row = selectedMetrics.find((r) => r.metricCode === metric.code);
                    const score = row ? Number(row.score) : null;
                    const pct =
                      score != null && Number.isFinite(score)
                        ? Math.min(100, Math.max(0, score))
                        : 0;
                    return (
                      <li key={metric.code} className="kpi-dash-metric-row">
                        <div className="kpi-dash-metric-head">
                          <span>{metric.label}</span>
                          <span className="text-muted-foreground">
                            {score != null && Number.isFinite(score)
                              ? `${Math.round(score * 10) / 10}`
                              : "—"}
                            <span className="opacity-70"> · wt {metric.weight}%</span>
                          </span>
                        </div>
                        <div className="kpi-dash-metric-track" aria-hidden>
                          <div className="kpi-dash-metric-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="kpi-dash-panel">
              <div className="kpi-dash-panel-head">
                <div>
                  <h3 className="kpi-dash-panel-title">Team metric averages</h3>
                  <p className="kpi-dash-panel-sub">Across all scored employees (not page-scoped)</p>
                </div>
              </div>
              <ul className="kpi-dash-metric-list">
                {metricAverages.map((metric) => {
                  const pct =
                    metric.avg != null ? Math.min(100, Math.max(0, metric.avg)) : 0;
                  return (
                    <li key={metric.code} className="kpi-dash-metric-row">
                      <div className="kpi-dash-metric-head">
                        <span>{metric.label}</span>
                        <span className="text-muted-foreground">
                          {metric.avg != null ? `${Math.round(metric.avg)}%` : "—"}
                          <span className="opacity-70"> · {metric.scored} rows</span>
                        </span>
                      </div>
                      <div className="kpi-dash-metric-track" aria-hidden>
                        <div className="kpi-dash-metric-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      </QueryState>
    </div>
  );
}
