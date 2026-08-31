"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TimeMetricGrid } from "@/components/time/TaskTimeTimeline";
import { ROUTES } from "@/config/routes";
import { useMyTimeSummary } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

export function EmployeeTimeView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const summaryQuery = useMyTimeSummary(enabled);
  const { closeWorkday } = useTaskMutations();

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  const data = summaryQuery.data;

  return (
    <div className="page-shell">
      <PageHeader
        title="My Time Today"
        subtitle="Server-authoritative active work, hold time, and workday status"
        actions={
          data && !data.workdayClosed ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={closeWorkday.isPending || data.currentTask?.status === "RUNNING"}
              onClick={() => closeWorkday.mutate()}
              title={
                data.currentTask?.status === "RUNNING"
                  ? "Stop running task before closing workday"
                  : undefined
              }
            >
              Close Workday
            </button>
          ) : data?.workdayClosed ? (
            <StatusBadge status="COMPLETED" label="Workday closed" />
          ) : undefined
        }
      />

      <QueryState
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
        error={summaryQuery.error}
        onRetry={() => summaryQuery.refetch()}
        skeletonVariant="stats"
      >
        {data && (
          <>
            <TimeMetricGrid
              activeSeconds={data.totals.activeSeconds}
              holdSeconds={data.totals.holdSeconds}
              totalElapsedSeconds={data.totals.activeSeconds + data.totals.holdSeconds}
              extra={[
                { label: "Open tasks", value: String(data.totals.openTasks) },
                { label: "Overdue", value: String(data.totals.overdueTasks) },
              ]}
            />

            {data.currentTask && (
              <div className="card" style={{ marginTop: "1rem" }}>
                <div className="card-header">
                  <span className="card-title">Current task</span>
                  <StatusBadge status={data.currentTask.status} />
                </div>
                <p style={{ margin: "0 0 0.75rem" }}>
                  {data.currentTask.ideaRef} · {data.currentTask.subProcessName}
                </p>
                <p style={{ margin: 0, color: "var(--color-neutral-500)" }}>
                  Active: {formatDuration(data.currentTask.activeSeconds)} · Hold:{" "}
                  {formatDuration(data.currentTask.holdSeconds)}
                </p>
                <Link
                  href={ROUTES.work.taskDetail(data.currentTask.taskId)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: "1rem" }}
                >
                  Open task workspace
                </Link>
              </div>
            )}

            {data.totals.holdByReason.length > 0 && (
              <div className="card" style={{ marginTop: "1rem" }}>
                <span className="card-title">Hold reasons today</span>
                <ul className="detail-task-list" style={{ marginTop: "0.75rem" }}>
                  {data.totals.holdByReason.map((h) => (
                    <li key={h.code}>
                      <span>{h.name}</span>
                      <span>{formatDuration(h.seconds)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card" style={{ marginTop: "1rem" }}>
              <span className="card-title">Tasks with time logged today</span>
              {data.tasksToday.length === 0 ? (
                <p style={{ color: "var(--color-neutral-500)", margin: "0.75rem 0 0" }}>
                  No task time recorded yet today.
                </p>
              ) : (
                <div className="data-table-wrap" style={{ marginTop: "0.75rem" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Design</th>
                        <th>Step</th>
                        <th>Status</th>
                        <th>Active</th>
                        <th>Hold</th>
                        <th>Expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tasksToday.map((task) => (
                        <tr key={task.taskId}>
                          <td>
                            <Link href={ROUTES.work.taskDetail(task.taskId)} className="data-table-link">
                              {task.ideaRef}
                            </Link>
                          </td>
                          <td>{task.subProcessName}</td>
                          <td>
                            <StatusBadge status={task.status} />
                          </td>
                          <td>{formatDuration(task.activeSeconds)}</td>
                          <td>{formatDuration(task.holdSeconds)}</td>
                          <td>{task.expectedMinutes} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
