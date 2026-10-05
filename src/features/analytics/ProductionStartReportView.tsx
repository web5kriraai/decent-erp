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
import { useProductionStartReport, type ProductionStartReport } from "@/hooks/use-reports";
import { useClientList } from "@/hooks/use-client-list";

type DesignRow = ProductionStartReport["designs"][number];

function designSearchText(row: DesignRow) {
  return `${row.ideaRef} ${row.designNumber ?? ""} ${row.collectionName} ${row.productType?.name ?? ""} ${row.status}`;
}

export function ProductionStartReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const reportQuery = useProductionStartReport(year, month, enabled);

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
  const byProductType = report?.byProductType ?? [];

  return (
    <ListPage
      title="Production Start Report"
      subtitle="Designs that reached production accepted or released in the selected month."
      wide
      filters={
        <ListPeriodFilter
          yearId="psYear"
          monthId="psMonth"
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
        "aria-label": "Search production start designs",
      }}
      onRefresh={() => reportQuery.refetch()}
      isRefreshing={reportQuery.isFetching}
      beforeTable={
        report ? (
          <>
            <div className="stat-grid">
              <StatCard label="Production starts" value={report.total} />
              <StatCard label="Product types" value={byProductType.length} />
            </div>
            <p className="m-0 text-sm font-medium">By product type</p>
            <ul className="detail-task-list">
              {byProductType.length === 0 ? (
                <li>
                  <span className="text-muted-foreground">No starts this period</span>
                  <strong>0</strong>
                </li>
              ) : (
                byProductType.map((row) => (
                  <li key={row.code}>
                    <span>{row.name}</span>
                    <strong>{row.count}</strong>
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
        pageSizeSelectId: "production-start-page-size",
      }}
    >
      <DataTable
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) =>
              `${row.ideaRef}${row.designNumber ? ` · ${row.designNumber}` : ""} - ${row.collectionName}`,
          },
          {
            key: "product",
            header: "Product",
            render: (row) => row.productType?.name ?? "-",
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
        ]}
        rows={list.pageItems}
        getRowKey={(row) => String(row.id)}
        emptyTitle="No production starts for this period"
        emptyDescription="Designs accepted or released to production in this month appear here."
      />
    </ListPage>
  );
}
