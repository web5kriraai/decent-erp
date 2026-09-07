"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/config/routes";

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

  const data = kpiQuery.data;
  const periodLabel = data
    ? `${data.periodMonth}/${data.periodYear}`
    : new Date().toLocaleString("en", { month: "short", year: "numeric" });

  return (
    <div className="page-shell">
      <PageHeader
        title="Design Head KPI"
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
        {data ? (
          <>
            <div className="stat-grid stack-section">
              <StatCard label="Ideas" value={data.ideasCreated} />
              <StatCard label="Approved" value={data.approvedCount} />
              <StatCard label="Released" value={data.releasedCount} />
              <StatCard label="Live" value={data.liveCount} />
              <StatCard
                label="Conversion"
                value={`${data.conversionPercent}%`}
                tone="accent"
                trend={periodLabel}
              />
            </div>

            <AppCard title="Score detail" className="stack-section" flush>
              <DataTable
                columns={[
                  {
                    key: "employee",
                    header: "Design Head",
                    render: (r) => r.employee.name,
                  },
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
                emptyTitle="No scores"
                emptyDescription="Run Recompute."
              />
            </AppCard>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
