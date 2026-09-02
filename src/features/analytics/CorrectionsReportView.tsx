"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useCorrectionAnalysisReport } from "@/hooks/use-reports";
import { useSession } from "next-auth/react";

export function CorrectionsReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const reportQuery = useCorrectionAnalysisReport(enabled);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const summary = reportQuery.data?.summary;
  const corrections = reportQuery.data?.corrections ?? [];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Correction Analysis"
        subtitle="Mistake vs improvement trends, extra time, and cost impact"
      />

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="stats"
      >
        {summary ? (
          <>
            <div className="stat-grid stack-section">
              <StatCard label="Total corrections" value={corrections.length} />
              <StatCard label="Extra minutes" value={summary.totalExtraMinutes} />
              <StatCard
                label="Extra cost"
                value={`₹${summary.totalExtraCost.toLocaleString()}`}
              />
              <StatCard
                label="Mistake types"
                value={Object.keys(summary.byType).length}
              />
            </div>

            <AppCard className="stack-section" title="By correction type">
              <ul className="detail-task-list">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <li key={type}>
                    <span>{type.replace(/_/g, " ")}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </AppCard>

            <DataTable
              columns={[
                {
                  key: "design",
                  header: "Design",
                  render: (row) =>
                    row.design
                      ? `${row.design.ideaRef} — ${row.design.collectionName}`
                      : "—",
                },
                { key: "correctionType", header: "Type" },
                {
                  key: "stage",
                  header: "Stage",
                  render: (row) => row.task?.subProcess?.name ?? "—",
                },
                {
                  key: "responsible",
                  header: "Responsible",
                  render: (row) => row.responsibleEmployee?.name ?? "—",
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: "extraMinutes",
                  header: "Extra min",
                  align: "right",
                  render: (row) => row.extraMinutes ?? 0,
                },
              ]}
              rows={corrections}
              getRowKey={(row) => String(row.id)}
              emptyTitle="No corrections recorded"
            />
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
