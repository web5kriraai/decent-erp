"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { ListDateRangeFilter } from "@/components/ui/ListDateRangeFilter";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { useTimeReport } from "@/hooks/use-time";
import { useClientList } from "@/hooks/use-client-list";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

type ReportRow = {
  employeeId: number;
  name: string;
  employeeCode: string;
  role: { name: string };
  tasksWorked: number;
  tasksCompleted: number;
  workdaysClosed: number;
  activeSeconds: number;
  holdSeconds: number;
  holdByReason: Array<{ name: string; seconds: number }>;
} & Record<string, unknown>;

function reportSearchText(row: ReportRow) {
  return [row.name, row.employeeCode, row.role.name, row.holdByReason[0]?.name]
    .filter(Boolean)
    .join(" ");
}

export function EmployeeTimeReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);

  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const [from, setFrom] = useState(toDateInput(weekAgo));
  const [to, setTo] = useState(toDateInput(today));

  const reportQuery = useTimeReport(from, to, enabled);

  const rows = (reportQuery.data?.rows ?? []) as ReportRow[];
  const getSearchText = useCallback(reportSearchText, []);
  const dateRangeKey = `${from}-${to}`;

  const list = useClientList({
    items: rows,
    getSearchText,
    filterKey: dateRangeKey,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  return (
    <ListPage
      title="Employee Time Report"
      wide
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search employee, role…",
        "aria-label": "Search time report",
      }}
      filters={
        <ListDateRangeFilter
          fromId="report-from"
          toId="report-to"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      }
      onRefresh={() => reportQuery.refetch()}
      isRefreshing={reportQuery.isFetching}
      query={{
        isLoading: reportQuery.isLoading,
        isError: reportQuery.isError,
        error: reportQuery.error,
        onRetry: () => reportQuery.refetch(),
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "time-report-page-size",
      }}
    >
      <DataTable<ReportRow>
        flush
        rows={list.pageItems as ReportRow[]}
        getRowKey={(row) => String(row.employeeId)}
        emptyTitle="No time records found"
        emptyDescription="Try widening the date range or confirm employees logged task time in this period."
        columns={[
          {
            key: "name",
            header: "Employee",
            render: (row) => <strong>{row.name}</strong>,
          },
          {
            key: "role",
            header: "Role",
            render: (row) => row.role.name.replace(/_/g, " "),
          },
          { key: "tasksWorked", header: "Tasks worked" },
          { key: "tasksCompleted", header: "Completed" },
          { key: "workdaysClosed", header: "Workdays closed" },
          {
            key: "activeSeconds",
            header: "Active",
            render: (row) => formatDuration(row.activeSeconds),
          },
          {
            key: "holdSeconds",
            header: "Hold",
            render: (row) => formatDuration(row.holdSeconds),
          },
          {
            key: "holdByReason",
            header: "Top hold reason",
            render: (row) =>
              row.holdByReason[0]
                ? `${row.holdByReason[0].name} (${formatDuration(row.holdByReason[0].seconds)})`
                : "-",
          },
        ]}
      />
    </ListPage>
  );
}
