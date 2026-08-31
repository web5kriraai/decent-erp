"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/config/routes";
import { useLiveTeamTime } from "@/hooks/use-time";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

export function AdminTimeLiveView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const liveQuery = useLiveTeamTime(enabled);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  const data = liveQuery.data;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Live Team Time"
        subtitle="Who is working now — server-tracked timers across all employees"
        actions={
          <Link href={ROUTES.analytics.timeReport} className="btn btn-secondary btn-sm">
            Time reports
          </Link>
        }
      />

      <QueryState
        isLoading={liveQuery.isLoading}
        isError={liveQuery.isError}
        error={liveQuery.error}
        onRetry={() => liveQuery.refetch()}
        skeletonVariant="stats"
      >
        {data && (
          <>
            <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
              <StatCard label="Running now" value={data.runningCount} accent />
              <StatCard label="On hold" value={data.onHoldCount} />
              <StatCard label="Idle" value={data.employees.filter((e) => e.status === "IDLE").length} />
              <StatCard
                label="Last refresh"
                value={new Date(data.asOfUtc).toLocaleTimeString()}
                trend="Auto-updates every 15s"
              />
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Current task</th>
                    <th>Active</th>
                    <th>Hold</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <strong>{row.name}</strong>
                        <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                          {row.employeeCode}
                        </div>
                      </td>
                      <td>{row.role.name.replace(/_/g, " ")}</td>
                      <td>
                        <StatusBadge
                          status={row.status === "IDLE" ? "PENDING" : row.status}
                          label={row.status === "IDLE" ? "Idle" : undefined}
                        />
                      </td>
                      <td>
                        {row.task ? (
                          <>
                            <Link href={ROUTES.work.taskDetail(row.task.taskId)} className="data-table-link">
                              {row.task.ideaRef}
                            </Link>
                            <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                              {row.task.subProcessName}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row.task ? formatDuration(row.task.activeSeconds) : "—"}</td>
                      <td>{row.task ? formatDuration(row.task.holdSeconds) : "—"}</td>
                      <td>
                        {row.task?.dueAt
                          ? new Date(row.task.dueAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
