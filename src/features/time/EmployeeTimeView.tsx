"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TimeMetricGrid } from "@/components/time/TaskTimeTimeline";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { ROUTES } from "@/config/routes";
import { useMyTimeSummary } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

type TodayTaskRow = {
  taskId: string;
  ideaRef: string;
  subProcessName: string;
  status: string;
  activeSeconds: number;
  holdSeconds: number;
  expectedMinutes: number;
} & Record<string, unknown>;

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
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={closeWorkday.isPending || data.currentTask?.status === "RUNNING"}
              onClick={() => closeWorkday.mutate()}
              title={
                data.currentTask?.status === "RUNNING"
                  ? "Stop running task before closing workday"
                  : undefined
              }
            >
              Close Workday
            </AppButton>
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
            <div className="stack-section">
              <TimeMetricGrid
                activeSeconds={data.totals.activeSeconds}
                holdSeconds={data.totals.holdSeconds}
                totalElapsedSeconds={data.totals.activeSeconds + data.totals.holdSeconds}
                extra={[
                  { label: "Open tasks", value: String(data.totals.openTasks) },
                  { label: "Overdue", value: String(data.totals.overdueTasks) },
                ]}
              />
            </div>

            {data.currentTask && (
              <AppCard
                className="stack-section"
                title="Current task"
                headerAction={<StatusBadge status={data.currentTask.status} />}
              >
                <p className="workbench-row-meta">
                  {data.currentTask.ideaRef} · {data.currentTask.subProcessName}
                </p>
                <p className="workbench-row-meta">
                  Active: {formatDuration(data.currentTask.activeSeconds)} · Hold:{" "}
                  {formatDuration(data.currentTask.holdSeconds)}
                </p>
                <AppButtonLink
                  href={ROUTES.work.taskDetail(data.currentTask.taskId)}
                  appVariant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Open task workspace
                </AppButtonLink>
              </AppCard>
            )}

            {data.totals.holdByReason.length > 0 && (
              <AppCard className="stack-section" title="Hold reasons today">
                <ul className="detail-task-list mt-3">
                  {data.totals.holdByReason.map((h) => (
                    <li key={h.code}>
                      <span>{h.name}</span>
                      <span>{formatDuration(h.seconds)}</span>
                    </li>
                  ))}
                </ul>
              </AppCard>
            )}

            <AppCard className="stack-section" title="Tasks with time logged today" contentClassName="p-0">
              <DataTable<TodayTaskRow>
                rows={data.tasksToday as TodayTaskRow[]}
                getRowKey={(row) => row.taskId}
                emptyTitle="No task time recorded yet today"
                columns={[
                  {
                    key: "ideaRef",
                    header: "Design",
                    render: (row) => (
                      <Link href={ROUTES.work.taskDetail(row.taskId)} className="data-table-link">
                        {row.ideaRef}
                      </Link>
                    ),
                  },
                  { key: "subProcessName", header: "Step" },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
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
                    key: "expectedMinutes",
                    header: "Expected",
                    render: (row) => `${row.expectedMinutes} min`,
                  },
                ]}
              />
            </AppCard>
          </>
        )}
      </QueryState>
    </div>
  );
}
