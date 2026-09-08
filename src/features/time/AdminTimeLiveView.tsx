"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  IconClock3,
  IconPauseCircle,
  IconPlayCircle,
  IconRefreshCw,
  IconUserRound,
} from "@/components/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
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
import { ROUTES } from "@/config/routes";
import { useLiveTeamTime } from "@/hooks/use-time";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import type { LiveTeamTimeRow } from "@/lib/types/api";
import { cn } from "@/lib/utils";

type StatusFilter = "ACTIVE" | "RUNNING" | "ON_HOLD" | "IDLE" | "ALL";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

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

function CompactPersonRow({
  row,
  canAdjust,
  onAdjust,
}: {
  row: LiveTeamTimeRow;
  canAdjust: boolean;
  onAdjust: (row: LiveTeamTimeRow) => void;
}) {
  const busy = row.status !== "IDLE" && row.task;

  return (
    <article
      className={cn(
        "live-time-compact",
        row.status === "RUNNING" && "live-time-compact--running",
        row.status === "ON_HOLD" && "live-time-compact--hold",
        row.status === "IDLE" && "live-time-compact--idle",
      )}
    >
      <span
        className={cn(
          "live-time-avatar",
          row.status === "RUNNING" && "live-time-avatar--running",
          row.status === "ON_HOLD" && "live-time-avatar--hold",
        )}
        aria-hidden
      >
        {initials(row.name)}
      </span>

      <div className="live-time-compact-main min-w-0">
        <div className="live-time-person-title-row">
          <h3 className="live-time-person-name">{row.name}</h3>
          <StatusBadge
            status={statusBadgeStatus(row.status)}
            label={statusLabel(row.status)}
          />
        </div>
        <p className="live-time-person-role">{formatRoleName(row.role.name)}</p>
        {busy && row.task ? (
          <p className="live-time-compact-task">
            <Link href={ROUTES.work.taskDetail(row.task.taskId)} className="live-time-task-link">
              {row.task.ideaRef}
            </Link>
            <span className="live-time-task-meta">
              {" "}
              · {row.task.subProcessName} · {formatDuration(row.task.activeSeconds)} active
            </span>
          </p>
        ) : (
          <p className="live-time-compact-task text-muted-foreground">No active task</p>
        )}
      </div>

      <div className="live-time-compact-actions">
        {busy && row.task ? (
          <>
            <AppButtonLink
              href={ROUTES.work.taskDetail(row.task.taskId)}
              appVariant="outline"
              size="sm"
            >
              Open
            </AppButtonLink>
            {canAdjust ? (
              <AppButton
                type="button"
                appVariant="secondary"
                size="sm"
                onClick={() => onAdjust(row)}
              >
                Adjust
              </AppButton>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export function AdminTimeLiveView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const canAdjust = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const liveQuery = useLiveTeamTime(enabled);
  const toast = useApiToast();

  const [filter, setFilter] = useState<StatusFilter>("ACTIVE");
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

  const filtered = useMemo(() => {
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

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TIME_VIEW_TEAM} />
      </div>
    );
  }

  const data = liveQuery.data;

  const railFilters: Array<{
    key: StatusFilter;
    label: string;
    count: number;
    icon: ReactNode;
  }> = [
    {
      key: "ACTIVE",
      label: "Working now",
      count: activeCount,
      icon: <IconPlayCircle className="size-4" />,
    },
    {
      key: "RUNNING",
      label: "Running",
      count: data?.runningCount ?? 0,
      icon: <IconPlayCircle className="size-4" />,
    },
    {
      key: "ON_HOLD",
      label: "On hold",
      count: data?.onHoldCount ?? 0,
      icon: <IconPauseCircle className="size-4" />,
    },
    {
      key: "IDLE",
      label: "Idle",
      count: idleCount,
      icon: <IconUserRound className="size-4" />,
    },
    {
      key: "ALL",
      label: "Everyone",
      count: employees.length,
      icon: <IconClock3 className="size-4" />,
    },
  ];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Live Team Time"
        subtitle="Who is working, on hold, or idle — updates every 15 seconds."
        actions={
          <div className="live-time-header-actions">
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              className="inline-flex items-center gap-1.5"
              onClick={() => liveQuery.refetch()}
              disabled={liveQuery.isFetching}
            >
              <IconRefreshCw
                className={cn("size-3.5", liveQuery.isFetching && "animate-spin")}
                aria-hidden
              />
              Refresh
            </AppButton>
            <AppButtonLink href={ROUTES.analytics.timeReport} appVariant="secondary" size="sm">
              Time report
            </AppButtonLink>
          </div>
        }
      />

      <QueryState
        isLoading={liveQuery.isLoading}
        isError={liveQuery.isError}
        error={liveQuery.error}
        onRetry={() => liveQuery.refetch()}
        skeletonVariant="stats"
      >
        {data ? (
          <div className="live-time-shell">
            <aside className="live-time-rail" aria-label="Status filters">
              <p className="live-time-rail-label">Focus</p>
              <ul className="live-time-rail-list">
                {railFilters.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={cn(
                        "live-time-rail-btn",
                        filter === item.key && "live-time-rail-btn--selected",
                      )}
                      aria-pressed={filter === item.key}
                      onClick={() => setFilter(item.key)}
                    >
                      <span className="live-time-rail-btn-icon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="live-time-rail-btn-copy">
                        <span className="live-time-rail-btn-label">{item.label}</span>
                        <span className="live-time-rail-btn-count">{item.count}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="live-time-rail-meta">
                Last refresh {new Date(data.asOfUtc).toLocaleTimeString()}
              </p>
            </aside>

            <section className="live-time-main" aria-label="Team board">
              <div className="live-time-main-head">
                <h2 className="live-time-main-title">
                  {railFilters.find((f) => f.key === filter)?.label ?? "Team"}
                </h2>
                <p className="live-time-auto-hint">Auto-updates every 15s</p>
              </div>

              {filtered.length === 0 ? (
                <div className="live-time-empty" role="status">
                  <p className="live-time-empty-title">No people in this focus</p>
                  <p className="live-time-empty-text">
                    Switch focus or wait for someone to start a task.
                  </p>
                </div>
              ) : (
                <div className="live-time-compact-board">
                  {filtered.map((row) => (
                    <CompactPersonRow
                      key={row.employeeId}
                      row={row}
                      canAdjust={canAdjust}
                      onAdjust={(person) => {
                        if (!person.task) return;
                        setAdjustTarget({
                          taskId: person.task.taskId,
                          ideaRef: person.task.ideaRef,
                          activeSeconds: person.task.activeSeconds,
                        });
                        setAdjustSeconds("0");
                        setAdjustRemark("");
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </QueryState>

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
    </div>
  );
}
