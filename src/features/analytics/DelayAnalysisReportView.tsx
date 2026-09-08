"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type DelayReport = {
  total: number;
  byStage: Record<string, number>;
  tasks: Array<{
    id: string;
    designId: string;
    ideaRef: string;
    collectionName: string;
    stage: string;
    assignee: string | null;
    dueAt: string;
    status: string;
    overdueDays: number;
  }>;
};

export function DelayAnalysisReportView() {
  const { data: session } = useSession();
  const enabled = (session?.user?.permissions ?? []).includes(PERMISSIONS.KPI_ADMIN);
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.delay,
    queryFn: () => apiGet<DelayReport>("/api/reports/delay"),
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

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Delay Analysis"
        subtitle="Open tasks past dueAt, ordered by oldest due date."
        actions={
          <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
            Reports Hub
          </AppButtonLink>
        }
      />
      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Overdue tasks" value={report?.total ?? 0} tone="warning" />
          {Object.entries(report?.byStage ?? {})
            .slice(0, 4)
            .map(([stage, count]) => (
              <StatCard key={stage} label={stage.replace(/_/g, " ")} value={count} />
            ))}
        </div>
        <DataTable
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) => (
                <Link href={ROUTES.work.taskDetail(row.id)} className="data-table-link">
                  {row.ideaRef}
                </Link>
              ),
            },
            { key: "stage", header: "Stage" },
            { key: "assignee", header: "Assignee", render: (r) => r.assignee ?? "—" },
            {
              key: "dueAt",
              header: "Due",
              render: (r) => new Date(r.dueAt).toLocaleDateString(),
            },
            { key: "overdueDays", header: "Days late" },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
          rows={report?.tasks ?? []}
          getRowKey={(r) => r.id}
          emptyTitle="No overdue tasks"
        />
      </QueryState>
    </div>
  );
}
