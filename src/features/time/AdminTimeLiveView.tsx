"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Clock3Icon,
  PauseCircleIcon,
  PlayCircleIcon,
  RefreshCwIcon,
  UserRoundIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppCard } from "@/components/ui/AppCard";
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

type StatusFilter = "ALL" | "RUNNING" | "ON_HOLD" | "IDLE";

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

function MetricChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("live-time-metric", accent && "live-time-metric--accent")}>
      <span className="live-time-metric-icon" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="live-time-metric-label">{label}</p>
        <p className="live-time-metric-value">{value}</p>
      </div>
    </div>
  );
}

function PersonRow({
  row,
  canAdjust,
  onAdjust,
}: {
  row: LiveTeamTimeRow;
  canAdjust: boolean;
  onAdjust: (row: LiveTeamTimeRow) => void;
}) {
  const busy = row.status !== "IDLE" && row.task;
  const dueLabel = row.task?.dueAt
    ? new Date(row.task.dueAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <article
      className={cn(
        "live-time-person",
        row.status === "RUNNING" && "live-time-person--running",
        row.status === "ON_HOLD" && "live-time-person--hold",
        row.status === "IDLE" && "live-time-person--idle",
      )}
    >
      <div className="live-time-person-main">
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
        <div className="min-w-0">
          <div className="live-time-person-title-row">
            <h3 className="live-time-person-name">{row.name}</h3>
            <StatusBadge
              status={statusBadgeStatus(row.status)}
              label={statusLabel(row.status)}
            />
          </div>
          <p className="live-time-person-role">{formatRoleName(row.role.name)}</p>
          <p className="live-time-person-code">{row.employeeCode}</p>
        </div>
      </div>

      <div className="live-time-person-task">
        {busy && row.task ? (
          <>
            <p className="live-time-task-label">Current task</p>
            <Link
              href={ROUTES.work.taskDetail(row.task.taskId)}
              className="live-time-task-link"
            >
              {row.task.ideaRef}
            </Link>
            <p className="live-time-task-meta">
              {row.task.subProcessName}
              {row.task.collectionName ? ` · ${row.task.collectionName}` : ""}
            </p>
          </>
        ) : (
          <div className="live-time-idle-note">
            <UserRoundIcon className="size-4" aria-hidden />
            <span>No active task</span>
          </div>
        )}
      </div>

      <div className="live-time-person-times">
        <div className="live-time-stat">
          <span className="live-time-stat-label">Active</span>
          <span className="live-time-stat-value">
            {row.task ? formatDuration(row.task.activeSeconds) : "—"}
          </span>
        </div>
        <div className="live-time-stat">
          <span className="live-time-stat-label">Hold</span>
          <span className="live-time-stat-value">
            {row.task ? formatDuration(row.task.holdSeconds) : "—"}
          </span>
        </div>
        <div className="live-time-stat">
          <span className="live-time-stat-label">Due</span>
          <span className="live-time-stat-value">{dueLabel ?? "—"}</span>
        </div>
      </div>

      <div className="live-time-person-actions">
        {busy && row.task ? (
          <>
            <AppButtonLink
              href={ROUTES.work.taskDetail(row.task.taskId)}
              appVariant="outline"
              size="sm"
            >
              Open task
            </AppButtonLink>
            {canAdjust ? (
              <AppButton
                type="button"
                appVariant="secondary"
                size="sm"
                onClick={() => onAdjust(row)}
              >
                Adjust time
              </AppButton>
            ) : null}
          </>
        ) : (
          <span className="live-time-action-idle">Waiting</span>
        )}
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

  const filtered = useMemo(() => {
    const list =
      filter === "ALL" ? employees : employees.filter((e) => e.status === filter);
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

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Live Team Time"
        subtitle="Who is working now — server-tracked timers across the team"
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
              <RefreshCwIcon
                className={cn("size-3.5", liveQuery.isFetching && "animate-spin")}
                aria-hidden
              />
              Refresh
            </AppButton>
            <AppButtonLink href={ROUTES.analytics.timeReport} appVariant="secondary" size="sm">
              Time reports
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
        {data && (
          <div className="live-time-page">
            <div className="live-time-metric-row">
              <MetricChip
                accent
                icon={<PlayCircleIcon className="size-4" />}
                label="Running now"
                value={String(data.runningCount)}
              />
              <MetricChip
                icon={<PauseCircleIcon className="size-4" />}
                label="On hold"
                value={String(data.onHoldCount)}
              />
              <MetricChip
                icon={<UserRoundIcon className="size-4" />}
                label="Idle"
                value={String(idleCount)}
              />
              <MetricChip
                icon={<Clock3Icon className="size-4" />}
                label="Last refresh"
                value={new Date(data.asOfUtc).toLocaleTimeString()}
              />
            </div>

            <AppCard
              title="Team board"
              description="Active people first. Idle teammates stay visible so coverage is clear."
              headerAction={
                <p className="live-time-auto-hint">Auto-updates every 15s</p>
              }
              contentClassName="live-time-card-content"
            >
              <div className="live-time-filters" role="tablist" aria-label="Filter by status">
                {(
                  [
                    ["ALL", "All", employees.length],
                    ["RUNNING", "Working", data.runningCount],
                    ["ON_HOLD", "On hold", data.onHoldCount],
                    ["IDLE", "Idle", idleCount],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    className={cn(
                      "live-time-filter",
                      filter === key && "live-time-filter--active",
                    )}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                    <span className="live-time-filter-count">{count}</span>
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="live-time-empty" role="status">
                  <p className="live-time-empty-title">No people in this filter</p>
                  <p className="live-time-empty-text">
                    Switch filters or wait for someone to start a task.
                  </p>
                </div>
              ) : (
                <div className="live-time-board">
                  {filtered.map((row) => (
                    <PersonRow
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
            </AppCard>
          </div>
        )}
      </QueryState>

      <Modal
        open={!!adjustTarget}
        title="Admin time adjustment"
        description={
          adjustTarget
            ? `Record a manual adjustment for ${adjustTarget.ideaRef} (current active: ${formatDuration(adjustTarget.activeSeconds)})`
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
