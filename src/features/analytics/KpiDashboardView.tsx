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
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import Link from "next/link";
import { ROUTES } from "@/config/routes";

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

  return (
    <div className="page-shell">
      <PageHeader
        title="Performance KPI"
        subtitle="Weighted employee scores by role and period"
        actions={
          <>
            <Link href={ROUTES.analytics.kpiEmployees} className="btn btn-secondary btn-sm">
              Employee Detail
            </Link>
            <Link href={ROUTES.analytics.kpiDesignHead} className="btn btn-secondary btn-sm">
              Design Head
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={recompute.isPending}
              onClick={() => recompute.mutate()}
            >
              Recompute KPI
            </button>
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

        {chartData.length > 0 && (
          <div className="card" style={{ marginBottom: "1.5rem", height: 320 }}>
            <span className="card-title">Weighted score by employee</span>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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
