"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormTextField } from "@/components/ui/form-text-field";
import { PERMISSIONS } from "@/lib/permissions";
import { useSampleStatusReport } from "@/hooks/use-reports";

export function SampleStatusReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useSampleStatusReport(year, month, enabled);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const report = reportQuery.data;
  const byDecision = report?.byDecision ?? {};
  const byStage = report?.byStage ?? {};
  const designs = report?.designs ?? [];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Sample Status Report"
        subtitle="Sample decisions and current stage for the selected month."
      />

      <div className="toolbar stack-section">
        <FormTextField
          id="ssYear"
          label="Year"
          type="number"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value) || year)}
        />
        <FormTextField
          id="ssMonth"
          label="Month"
          type="number"
          min={1}
          max={12}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value) || month)}
        />
      </div>

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="Designs in period" value={report?.total ?? 0} />
          <StatCard label="Pass" value={byDecision.PASS ?? 0} />
          <StatCard label="Hold" value={byDecision.HOLD ?? 0} />
          <StatCard label="Reject" value={byDecision.REJECT ?? 0} />
          <StatCard label="Pending" value={byDecision.PENDING ?? 0} />
        </div>

        <AppCard className="stack-section" title="By current stage">
          <ul className="detail-task-list">
            {Object.entries(byStage).length === 0 ? (
              <li>
                <span className="text-muted-foreground">No stage data</span>
                <strong>0</strong>
              </li>
            ) : (
              Object.entries(byStage).map(([stage, count]) => (
                <li key={stage}>
                  <span>{stage.replace(/_/g, " ")}</span>
                  <strong>{count}</strong>
                </li>
              ))
            )}
          </ul>
        </AppCard>

        <DataTable
          columns={[
            {
              key: "design",
              header: "Design",
              render: (row) => `${row.ideaRef} - ${row.collectionName}`,
            },
            {
              key: "product",
              header: "Product",
              render: (row) => row.productType?.name ?? "-",
            },
            {
              key: "sampleDecision",
              header: "Sample",
              render: (row) => (
                <StatusBadge status={row.sampleDecision ?? "PENDING"} />
              ),
            },
            {
              key: "currentStage",
              header: "Stage",
              render: (row) => row.currentStage?.replace(/_/g, " ") ?? "-",
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
          rows={designs}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No sample-status designs for this period"
          emptyDescription="Decisions recorded this month (or pending concepts created this month) appear here."
        />
      </QueryState>
    </div>
  );
}
