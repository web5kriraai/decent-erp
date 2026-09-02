"use client";

import { useMemo, type ReactNode } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { AppCard } from "@/components/ui/AppCard";
import { useDesignCompletionSummary } from "@/hooks/use-designs";
import { formatDuration } from "@/lib/services/time-calculation";
import {
  countTerminalPhases,
  isDesignWorkflowComplete,
} from "@/lib/services/workflow-override-utils";
import type { DesignCompletionSummary, DesignSummary } from "@/lib/types/api";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  PauseCircleIcon,
  SkipForwardIcon,
  UsersIcon,
} from "lucide-react";

type DesignCompletionSummaryPanelProps = {
  designId: string;
  design: DesignSummary;
  enabled?: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function formatRange(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (!end) return `Started ${start.toLocaleString(undefined, opts)}`;
  return `${start.toLocaleString(undefined, opts)} → ${end.toLocaleString(undefined, opts)}`;
}

function percentOfExpected(activeSeconds: number, expectedMinutes: number) {
  if (expectedMinutes <= 0) return null;
  return Math.round((activeSeconds / (expectedMinutes * 60)) * 100);
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
    <div className={cn("completion-metric", accent && "completion-metric--accent")}>
      <span className="completion-metric-icon" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="completion-metric-label">{label}</p>
        <p className="completion-metric-value">{value}</p>
      </div>
    </div>
  );
}

function IncompleteState({
  doneCount,
  total,
}: {
  doneCount: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return (
    <div className="completion-locked" role="status">
      <div className="completion-locked-copy">
        <p className="completion-locked-title">Summary unlocks when every phase is finished</p>
        <p className="completion-locked-text">
          Complete or skip the remaining workflow phases to generate the team and time report.
        </p>
      </div>
      <div className="completion-progress-block">
        <div className="completion-progress-meta">
          <span>
            {doneCount} of {total} phases
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="completion-progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Workflow phase progress"
        >
          <div className="completion-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function SummaryBody({ data }: { data: DesignCompletionSummary }) {
  const expectedMinutes = useMemo(
    () => data.phases.reduce((sum, phase) => sum + (phase.expectedMinutes || 0), 0),
    [data.phases],
  );
  const pacePct = percentOfExpected(data.totals.totalActiveSeconds, expectedMinutes);

  return (
    <div className="completion-summary">
      <div className="completion-hero">
        <div className="completion-hero-copy">
          <StatusBadge status="COMPLETED" label="Workflow complete" />
          <p className="completion-hero-range">
            {formatRange(data.workflowStartedAt, data.workflowFinishedAt)}
          </p>
        </div>
        {pacePct != null ? (
          <div className="completion-pace" title="Active time vs total expected minutes">
            <span className="completion-pace-label">Pace vs plan</span>
            <span
              className={cn(
                "completion-pace-value",
                pacePct <= 100 ? "text-emerald-700" : "text-amber-800",
              )}
            >
              {pacePct}%
            </span>
          </div>
        ) : null}
      </div>

      <div className="completion-metric-row">
        <MetricChip
          accent
          icon={<Clock3Icon className="size-4" />}
          label="Active work"
          value={formatDuration(data.totals.totalActiveSeconds)}
        />
        <MetricChip
          icon={<PauseCircleIcon className="size-4" />}
          label="Hold time"
          value={formatDuration(data.totals.totalHoldSeconds)}
        />
        <MetricChip
          icon={<CircleDashedIcon className="size-4" />}
          label="Total elapsed"
          value={formatDuration(data.totals.totalElapsedSeconds)}
        />
        <MetricChip
          icon={<UsersIcon className="size-4" />}
          label="People"
          value={String(data.totals.peopleCount)}
        />
        <MetricChip
          icon={<SkipForwardIcon className="size-4" />}
          label="Skipped"
          value={String(data.totals.skippedPhaseCount)}
        />
      </div>

      <div className="completion-split">
        <section className="completion-panel" aria-labelledby="completion-team-heading">
          <div className="completion-panel-head">
            <h3 id="completion-team-heading">Team contribution</h3>
            <span className="completion-panel-count">{data.employees.length}</span>
          </div>
          {data.employees.length === 0 ? (
            <p className="completion-empty">No employee time recorded for this design.</p>
          ) : (
            <ul className="completion-person-list">
              {data.employees.map((row) => {
                const share =
                  data.totals.totalActiveSeconds > 0
                    ? Math.round((row.activeSeconds / data.totals.totalActiveSeconds) * 100)
                    : 0;
                return (
                  <li key={row.employeeId} className="completion-person">
                    <div className="completion-person-main">
                      <span className="completion-avatar" aria-hidden>
                        {initials(row.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="completion-person-name">{row.name}</p>
                        <p className="completion-person-role">{row.roleName}</p>
                      </div>
                    </div>
                    <div className="completion-person-stats">
                      <div className="completion-stat">
                        <span className="completion-stat-label">Active</span>
                        <span className="completion-stat-value">
                          {formatDuration(row.activeSeconds)}
                        </span>
                      </div>
                      <div className="completion-stat">
                        <span className="completion-stat-label">Done</span>
                        <span className="completion-stat-value">
                          {row.tasksCompleted}
                          {row.tasksSkippedAsAssignee > 0
                            ? ` · ${row.tasksSkippedAsAssignee} skip`
                            : ""}
                        </span>
                      </div>
                    </div>
                    <div className="completion-person-bar" aria-hidden>
                      <div className="completion-progress-track completion-progress-track--thin">
                        <div
                          className="completion-progress-fill"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <span className="completion-share">{share}% of active</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="completion-panel" aria-labelledby="completion-phase-heading">
          <div className="completion-panel-head">
            <h3 id="completion-phase-heading">Phase timeline</h3>
            <span className="completion-panel-count">{data.phases.length}</span>
          </div>
          {data.phases.length === 0 ? (
            <p className="completion-empty">No phase breakdown for this design.</p>
          ) : (
            <ol className="completion-phase-list">
              {data.phases.map((phase) => {
                const vsPlan = percentOfExpected(phase.activeSeconds, phase.expectedMinutes);
                return (
                  <li key={phase.taskId} className="completion-phase">
                    <div className="completion-phase-rail" aria-hidden>
                      {phase.status === "COMPLETED" ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : phase.status === "SKIPPED" ? (
                        <SkipForwardIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <CircleDashedIcon className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="completion-phase-body">
                      <div className="completion-phase-top">
                        <div className="min-w-0">
                          <p className="completion-phase-title">
                            <span className="completion-phase-seq">#{phase.sequence}</span>{" "}
                            {phase.name}
                          </p>
                          <p className="completion-phase-meta">
                            {phase.assignee?.name ?? "Unassigned"}
                            {phase.skipReason ? ` · ${phase.skipReason}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={phase.status} />
                      </div>
                      <div className="completion-phase-times">
                        <span>
                          Active <strong>{formatDuration(phase.activeSeconds)}</strong>
                        </span>
                        <span>
                          Expected <strong>{phase.expectedMinutes} min</strong>
                        </span>
                        {vsPlan != null ? (
                          <span
                            className={cn(
                              "completion-phase-pace",
                              vsPlan <= 100 ? "is-ok" : "is-over",
                            )}
                          >
                            {vsPlan}% of plan
                          </span>
                        ) : null}
                      </div>
                      {phase.expectedMinutes > 0 ? (
                        <div
                          className="completion-progress-track completion-progress-track--thin"
                          aria-hidden
                        >
                          <div
                            className={cn(
                              "completion-progress-fill",
                              vsPlan != null && vsPlan > 100 && "completion-progress-fill--over",
                            )}
                            style={{ width: `${Math.min(vsPlan ?? 0, 100)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {data.overrideHistory.length > 0 ? (
        <section className="completion-panel" aria-labelledby="completion-override-heading">
          <div className="completion-panel-head">
            <h3 id="completion-override-heading">Override history</h3>
            <span className="completion-panel-count">{data.overrideHistory.length}</span>
          </div>
          <ul className="completion-override-list">
            {data.overrideHistory.map((entry, index) => (
              <li key={`${entry.atUtc}-${index}`} className="completion-override">
                <div className="completion-override-main">
                  <p className="completion-override-action">
                    {entry.action.replace(/_/g, " ")}
                  </p>
                  <p className="completion-override-path">
                    {entry.fromStage ?? "—"} → {entry.toStage ?? "—"}
                    <span> · {entry.actor}</span>
                  </p>
                </div>
                {entry.reason ? (
                  <p className="completion-override-reason">{entry.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function DesignCompletionSummaryPanel({
  designId,
  design,
  enabled = true,
}: DesignCompletionSummaryPanelProps) {
  const tasks = design.tasks ?? [];
  const progress = countTerminalPhases(tasks);
  const isComplete = isDesignWorkflowComplete(tasks);
  const doneCount = progress.completed + progress.skipped + progress.cancelled;

  const summaryQuery = useDesignCompletionSummary(designId, enabled && isComplete);

  return (
    <AppCard
      className="stack-section"
      title="Completion summary"
      description={
        isComplete
          ? "Team effort and time across every finished phase."
          : `${doneCount} of ${progress.total} phases finished — unlocks when the workflow is complete.`
      }
      headerAction={
        !isComplete ? (
          <StatusBadge status="READY" label={`${doneCount}/${progress.total} phases`} />
        ) : (
          <StatusBadge status="COMPLETED" label="Ready" />
        )
      }
      contentClassName="completion-card-content"
    >
      {!isComplete ? (
        <IncompleteState doneCount={doneCount} total={progress.total} />
      ) : (
        <QueryState
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          skeletonVariant="table"
        >
          {summaryQuery.data ? <SummaryBody data={summaryQuery.data} /> : null}
        </QueryState>
      )}
    </AppCard>
  );
}
