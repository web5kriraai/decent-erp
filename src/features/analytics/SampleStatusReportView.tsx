"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ListPeriodFilter } from "@/components/ui/ListPeriodFilter";
import { PERMISSIONS } from "@/lib/permissions";
import { useSampleStatusReport, type SampleStatusReport } from "@/hooks/use-reports";
import { useClientList } from "@/hooks/use-client-list";

type DesignRow = SampleStatusReport["designs"][number];

function designSearchText(row: DesignRow) {
  return `${row.ideaRef} ${row.collectionName} ${row.productType?.name ?? ""} ${row.sampleDecision ?? ""} ${row.currentStage ?? ""} ${row.status}`;
}

export function SampleStatusReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useSampleStatusReport(year, month, enabled);

  const getSearchText = useCallback(designSearchText, []);
  const list = useClientList({
    items: reportQuery.data?.designs ?? [],
    getSearchText,
    filterKey: `${year}-${month}`,
  });

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

  return (
    <ListPage
      title="Sample Status Report"
      subtitle="Sample decisions and current stage for the selected month."
      wide
      filters={
        <ListPeriodFilter
          yearId="ssYear"
          monthId="ssMonth"
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      }
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search designs…",
        "aria-label": "Search sample status designs",
      }}
      onRefresh={() => reportQuery.refetch()}
      isRefreshing={reportQuery.isFetching}
      beforeTable={
        report ? (
          <>
            <div className="stat-grid">
              <StatCard label="Designs in period" value={report.total} />
              <StatCard label="Pass" value={byDecision.PASS ?? 0} />
              <StatCard label="Hold" value={byDecision.HOLD ?? 0} />
              <StatCard label="Reject" value={byDecision.REJECT ?? 0} />
              <StatCard label="Pending" value={byDecision.PENDING ?? 0} />
            </div>
            <p className="m-0 text-sm font-medium">By current stage</p>
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
          </>
        ) : null
      }
      query={{
        isLoading: reportQuery.isLoading,
        isError: reportQuery.isError,
        error: reportQuery.error,
        onRetry: () => reportQuery.refetch(),
        skeletonVariant: "table",
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "sample-status-page-size",
      }}
    >
      <DataTable
        flush
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
        rows={list.pageItems}
        getRowKey={(row) => String(row.id)}
        emptyTitle="No sample-status designs for this period"
        emptyDescription="Decisions recorded this month (or pending concepts created this month) appear here."
      />
    </ListPage>
  );
}
