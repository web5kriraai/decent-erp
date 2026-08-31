"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { useTimeReport } from "@/hooks/use-time";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
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

      <div className="card card--flat" style={{ marginBottom: "1rem" }}>
        <div className="toolbar" style={{ borderBottom: "none", paddingTop: 0 }}>
          <label className="form-group" style={{ margin: 0 }}>
            <span className="form-label">From</span>
            <input
              type="date"
              className="form-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="form-group" style={{ margin: 0 }}>
            <span className="form-label">To</span>
            <input
              type="date"
              className="form-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
      >
        {reportQuery.data && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Tasks worked</th>
                  <th>Completed</th>
                  <th>Workdays closed</th>
                  <th>Active</th>
                  <th>Hold</th>
                  <th>Top hold reason</th>
                </tr>
              </thead>
              <tbody>
                {reportQuery.data.rows.map((row) => (
                  <tr key={row.employeeId}>
                    <td>
                      <strong>{row.name}</strong>
                      <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                        {row.employeeCode}
                      </div>
                    </td>
                    <td>{row.role.name.replace(/_/g, " ")}</td>
                    <td>{row.tasksWorked}</td>
                    <td>{row.tasksCompleted}</td>
                    <td>{row.workdaysClosed}</td>
                    <td>{formatDuration(row.activeSeconds)}</td>
                    <td>{formatDuration(row.holdSeconds)}</td>
                    <td>
                      {row.holdByReason[0]
                        ? `${row.holdByReason[0].name} (${formatDuration(row.holdByReason[0].seconds)})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  );
}
