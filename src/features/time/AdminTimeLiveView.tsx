"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { ListPage } from "@/components/ui/ListPage";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { ROUTES } from "@/config/routes";
import { useLiveTeamTime } from "@/hooks/use-time";
import { useClientList } from "@/hooks/use-client-list";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import type { LiveTeamTimeRow } from "@/lib/types/api";
import { cn } from "@/lib/utils";

type StatusFilter = "ACTIVE" | "RUNNING" | "ON_HOLD" | "IDLE" | "ALL";

type LiveTeamTableRow = LiveTeamTimeRow & Record<string, unknown>;

function formatRoleName(name: string) {
  return name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function statusLabel(status: LiveTeamTimeRow["status"]) {
  if (status === "RUNNING") return "Working";
  if (status === "ON_HOLD") return "On hold";
  return "Idle";
}

function statusBadgeStatus(status: LiveTeamTimeRow["status"]) {
  if (status === "IDLE") return "PENDING";
  return status;
}

function liveTeamSearchText(row: LiveTeamTimeRow) {
  return [
    row.name,
    row.employeeCode,
    row.role.name,
    row.task?.ideaRef,
    row.task?.subProcessName,
    row.status,
  ]
    .filter(Boolean)
    .join(" ");
}

export function AdminTimeLiveView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const canAdjust = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const liveQuery = useLiveTeamTime(enabled);
  const toast = useApiToast();

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [adjustTarget, setAdjustTarget] = useState<{
    taskId: string;
    ideaRef: string;
    activeSeconds: number;
  } | null>(null);
  const [adjustSeconds, setAdjustSeconds] = useState("0");
  const [adjustRemark, setAdjustRemark] = useState("");

  const adjustTime = useMutation({
    mutationFn: () =>
      apiPost(`/api/tasks/${adjustTarget!.taskId}/time-adjust`, {
        remark: adjustRemark.trim(),
        adjustActiveSeconds: Number(adjustSeconds),
      }),
    onSuccess: () => {
      toast.success("Time adjusted", "Admin adjustment recorded in audit log");
      setAdjustTarget(null);
      setAdjustSeconds("0");
      setAdjustRemark("");
      liveQuery.refetch();
    },
    onError: (error) => toast.errorFromApi(error, "Could not adjust time"),
  });

  const employees = liveQuery.data?.employees ?? [];
  const idleCount = employees.filter((e) => e.status === "IDLE").length;
  const activeCount =
    (liveQuery.data?.runningCount ?? 0) + (liveQuery.data?.onHoldCount ?? 0);

  const statusFiltered = useMemo(() => {
    let list = employees;
    if (filter === "ACTIVE") {
      list = employees.filter((e) => e.status === "RUNNING" || e.status === "ON_HOLD");
    } else if (filter !== "ALL") {
      list = employees.filter((e) => e.status === filter);
    }
    return [...list].sort((a, b) => {
      const rank = (s: LiveTeamTimeRow["status"]) =>
        s === "RUNNING" ? 0 : s === "ON_HOLD" ? 1 : 2;
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.name.localeCompare(b.name);
    });
  }, [employees, filter]);

  const getSearchText = useCallback(liveTeamSearchText, []);

  const list = useClientList({
    items: statusFiltered as LiveTeamTableRow[],
    getSearchText,
    filterKey: filter,
    initialPageSize: 25,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  const data = liveQuery.data;

  const focusFilters: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "ACTIVE", label: "Working now", count: activeCount },
    { key: "RUNNING", label: "Running", count: data?.runningCount ?? 0 },
    { key: "ON_HOLD", label: "On hold", count: data?.onHoldCount ?? 0 },
    { key: "IDLE", label: "Idle", count: idleCount },
    { key: "ALL", label: "Everyone", count: employees.length },
  ];

  const focusLabel = focusFilters.find((f) => f.key === filter)?.label ?? "Team";

  return (
    <ListPage
      title="Live Team Time"
        subtitle="Who is working, on hold, or idle — updates every 15 seconds."
        wide
        className="live-time-page"
        actions={
          <AppButtonLink href={ROUTES.analytics.timeReport} appVariant="secondary" size="sm">
            Time report
          </AppButtonLink>
        }
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: "Search name, task, role…",
          "aria-label": "Search team members",
        }}
        filters={
          <div className="live-time-filters" role="group" aria-label="Focus">
            <span className="live-time-focus-label">Focus</span>
            {focusFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "live-time-filter",
                  filter === item.key && "live-time-filter--active",
                )}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                <span className="live-time-filter-count">{item.count}</span>
              </button>
            ))}
          </div>
        }
        toolbarExtra={
          data ? (
            <span className="live-time-auto-hint">
              Last refresh {new Date(data.asOfUtc).toLocaleTimeString()} · Auto every 15s
            </span>
          ) : null
        }
        onRefresh={() => liveQuery.refetch()}
        isRefreshing={liveQuery.isFetching}
        query={{
          isLoading: liveQuery.isLoading,
          isError: liveQuery.isError,
          error: liveQuery.error,
          onRetry: () => liveQuery.refetch(),
        }}
        pagination={{
          total: list.total,
          page: list.page,
          pageSize: list.pageSize,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
          pageSizeSelectId: "live-team-time-page-size",
        }}
        overlays={
          <Modal
            open={!!adjustTarget}
            title="Admin time adjustment"
            description={
              adjustTarget
                ? `${adjustTarget.ideaRef} · active ${formatDuration(adjustTarget.activeSeconds)}`
                : undefined
            }
            onClose={() => setAdjustTarget(null)}
            footer={
              <ModalFooterActions>
                <AppButton type="button" appVariant="outline" onClick={() => setAdjustTarget(null)}>
                  Cancel
                </AppButton>
                <AppButton
                  type="button"
                  disabled={!adjustRemark.trim() || adjustTime.isPending}
                  onClick={() => adjustTime.mutate()}
                >
                  {adjustTime.isPending ? "Saving…" : "Record adjustment"}
                </AppButton>
              </ModalFooterActions>
            }
          >
            <ModalForm>
              <ModalFormGrid>
                <FormTextField
                  id="adjustSeconds"
                  label="Adjust active seconds"
                  type="number"
                  value={adjustSeconds}
                  onChange={(e) => setAdjustSeconds(e.target.value)}
                />
                <FormTextField
                  id="adjustRemark"
                  label="Remark"
                  required
                  value={adjustRemark}
                  onChange={(e) => setAdjustRemark(e.target.value)}
                />
              </ModalFormGrid>
            </ModalForm>
          </Modal>
        }
      >
        <DataTable<LiveTeamTableRow>
          flush
          columns={[
            {
              key: "name",
              header: "Person",
              render: (row) => (
                <div className="live-time-person-cell">
                  <span className="font-medium text-foreground">{row.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatRoleName(row.role.name)}
                  </span>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <StatusBadge
                  status={statusBadgeStatus(row.status)}
                  label={statusLabel(row.status)}
                />
              ),
            },
            {
              key: "task",
              header: "Current task",
              render: (row) =>
                row.task ? (
                  <div className="live-time-person-cell">
                    <Link
                      href={ROUTES.work.taskDetail(row.task.taskId)}
                      className="data-table-link"
                    >
                      {row.task.ideaRef}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {row.task.subProcessName}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No active task</span>
                ),
            },
            {
              key: "active",
              header: "Active",
              render: (row) =>
                row.task ? formatDuration(row.task.activeSeconds) : "—",
            },
            {
              key: "hold",
              header: "Hold",
              render: (row) =>
                row.task ? formatDuration(row.task.holdSeconds) : "—",
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row) => {
                if (!row.task) return null;
                return (
                  <TableIconActionGroup>
                    <AppButtonLink
                      href={ROUTES.work.taskDetail(row.task.taskId)}
                      appVariant="outline"
                      size="sm"
                    >
                      Open
                    </AppButtonLink>
                    {canAdjust ? (
                      <TableIconAction
                        action="edit"
                        label="Adjust time"
                        onClick={() => {
                          if (!row.task) return;
                          setAdjustTarget({
                            taskId: row.task.taskId,
                            ideaRef: row.task.ideaRef,
                            activeSeconds: row.task.activeSeconds,
                          });
                          setAdjustSeconds("0");
                          setAdjustRemark("");
                        }}
                      />
                    ) : null}
                  </TableIconActionGroup>
                );
              },
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => String(row.employeeId)}
          emptyTitle={`No people in “${focusLabel}”`}
          emptyDescription="Switch focus or wait for someone to start a task."
        />
    </ListPage>
  );
}
