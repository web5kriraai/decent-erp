"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TimeMetricGrid } from "@/components/time/TaskTimeTimeline";
import { CloseWorkdayConfirm } from "@/components/tasks/CloseWorkdayConfirm";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { ROUTES } from "@/config/routes";
import { useMyTimeSummary } from "@/hooks/use-time";
import { useClientList } from "@/hooks/use-client-list";
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

function todayTaskSearchText(row: TodayTaskRow) {
  return [row.ideaRef, row.subProcessName, row.status].filter(Boolean).join(" ");
}

export function EmployeeTimeView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const summaryQuery = useMyTimeSummary(enabled);
  const { closeWorkday, openWorkday } = useTaskMutations();
  const [closeWorkdayOpen, setCloseWorkdayOpen] = useState(false);

  const data = summaryQuery.data;
  const tasksToday = (data?.tasksToday ?? []) as TodayTaskRow[];

  const getSearchText = useCallback(todayTaskSearchText, []);

  const list = useClientList({
    items: tasksToday,
    getSearchText,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  return (
    <>
    <ListPage
      title="My Time Today"
      actions={
        data && !data.workdayClosed ? (
          <AppButton
            type="button"
            appVariant="secondary"
            size="sm"
            disabled={closeWorkday.isPending || data.currentTask?.status === "RUNNING"}
            onClick={() => setCloseWorkdayOpen(true)}
            title={
              data.currentTask?.status === "RUNNING"
                ? "Stop running task before closing workday"
                : undefined
            }
          >
            Close Workday
          </AppButton>
        ) : data?.workdayClosed ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="COMPLETED" label="Workday closed" />
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              disabled={openWorkday.isPending}
              onClick={() => openWorkday.mutate()}
            >
              {openWorkday.isPending ? "Opening…" : "Open Workday"}
            </AppButton>
          </div>
        ) : undefined
      }
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search today's tasks…",
        "aria-label": "Search tasks with time logged today",
      }}
      onRefresh={() => summaryQuery.refetch()}
      isRefreshing={summaryQuery.isFetching}
      beforeTable={
        data ? (
          <div className="my-time-today__before">
            <TimeMetricGrid
              className="time-metric-grid--today"
              activeSeconds={data.totals.activeSeconds}
              holdSeconds={data.totals.holdSeconds}
              totalElapsedSeconds={data.totals.activeSeconds + data.totals.holdSeconds}
              extra={[
                { label: "Open tasks", value: String(data.totals.openTasks) },
                { label: "Overdue", value: String(data.totals.overdueTasks) },
              ]}
            />

            {data.currentTask ? (
              <AppCard
                title="Current task"
                className="my-time-today__current"
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
                  className="mt-3"
                >
                  Open task workspace
                </AppButtonLink>
              </AppCard>
            ) : null}

            {data.totals.holdByReason.length > 0 ? (
              <AppCard title="Hold reasons today">
                <ul className="detail-task-list mt-3">
                  {data.totals.holdByReason.map((h) => (
                    <li key={h.code}>
                      <span>{h.name}</span>
                      <span>{formatDuration(h.seconds)}</span>
                    </li>
                  ))}
                </ul>
              </AppCard>
            ) : null}
          </div>
        ) : undefined
      }
      query={{
        isLoading: summaryQuery.isLoading,
        isError: summaryQuery.isError,
        error: summaryQuery.error,
        onRetry: () => summaryQuery.refetch(),
        skeletonVariant: "stats",
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "my-time-today-page-size",
      }}
    >
      <DataTable<TodayTaskRow>
        flush
        rows={list.pageItems as TodayTaskRow[]}
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
    </ListPage>
    <CloseWorkdayConfirm
      open={closeWorkdayOpen}
      onClose={() => setCloseWorkdayOpen(false)}
      isPending={closeWorkday.isPending}
      onConfirm={() => {
        closeWorkday.mutate(undefined, {
          onSuccess: () => setCloseWorkdayOpen(false),
        });
      }}
    />
    </>
  );
}
