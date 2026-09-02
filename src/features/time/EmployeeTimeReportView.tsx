"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimeReport } from "@/hooks/use-time";
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

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Employee Time Report"
        subtitle="Active vs hold time aggregated from TaskTimeEvent records"
      />

      <AppCard flat className="stack-section-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </AppCard>

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
      >
        {reportQuery.data && (
          <AppCard contentClassName="p-0">
            <DataTable<ReportRow>
              rows={(reportQuery.data.rows ?? []) as ReportRow[]}
              getRowKey={(row) => String(row.employeeId)}
              emptyTitle="No time records found"
              emptyDescription="Try widening the date range or confirm employees logged task time in this period."
              columns={[
                {
                  key: "name",
                  header: "Employee",
                  render: (row) => (
                    <strong>{row.name}</strong>
                  ),
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
          </AppCard>
        )}
      </QueryState>
    </div>
  );
}
