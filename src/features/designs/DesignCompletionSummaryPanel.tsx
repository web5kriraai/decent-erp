"use client";

import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { TimeMetricGrid } from "@/components/time/TaskTimeTimeline";
import { useDesignCompletionSummary } from "@/hooks/use-designs";
import { formatDuration } from "@/lib/services/time-calculation";
import {
  countTerminalPhases,
  isDesignWorkflowComplete,
} from "@/lib/services/workflow-override-utils";
import type { DesignSummary } from "@/lib/types/api";

type DesignCompletionSummaryPanelProps = {
  designId: string;
  design: DesignSummary;
  enabled?: boolean;
};

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
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: "1rem" }}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Completion summary</h2>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? "Work and time recorded for this design across all phases."
              : `${doneCount} of ${progress.total} phases finished — summary unlocks when all phases are complete.`}
          </p>
        </div>
        {!isComplete ? (
          <StatusBadge status="IN_PROGRESS" label={`${doneCount}/${progress.total}`} />
        ) : null}
      </div>

      {!isComplete ? (
        <div
          className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          Complete or skip remaining workflow phases to generate the per-user work and time report.
        </div>
      ) : (
        <QueryState
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          onRetry={() => summaryQuery.refetch()}
          skeletonVariant="table"
        >
          {summaryQuery.data && (
            <div className="space-y-6">
              <TimeMetricGrid
                activeSeconds={summaryQuery.data.totals.totalActiveSeconds}
                holdSeconds={summaryQuery.data.totals.totalHoldSeconds}
                totalElapsedSeconds={summaryQuery.data.totals.totalElapsedSeconds}
                extra={[
                  { label: "People", value: String(summaryQuery.data.totals.peopleCount) },
                  { label: "Skipped phases", value: String(summaryQuery.data.totals.skippedPhaseCount) },
                ]}
              />

              <div>
                <h3 className="mb-2 text-sm font-semibold">By employee</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Completed</th>
                        <th>Skipped</th>
                        <th>Active time</th>
                        <th>Hold time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryQuery.data.employees.map((row) => (
                        <tr key={row.employeeId}>
                          <td>
                            {row.name}
                            <span className="block text-xs text-muted-foreground">{row.roleName}</span>
                          </td>
                          <td>{row.tasksCompleted}</td>
                          <td>{row.tasksSkippedAsAssignee}</td>
                          <td>{formatDuration(row.activeSeconds)}</td>
                          <td>{formatDuration(row.holdSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">By phase</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Assignee</th>
                        <th>Status</th>
                        <th>Active time</th>
                        <th>Expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryQuery.data.phases.map((phase) => (
                        <tr key={phase.taskId}>
                          <td>
                            #{phase.sequence} {phase.name}
                            {phase.skipReason ? (
                              <span className="block text-xs text-muted-foreground">{phase.skipReason}</span>
                            ) : null}
                          </td>
                          <td>{phase.assignee?.name ?? "Unassigned"}</td>
                          <td>
                            <StatusBadge status={phase.status} />
                          </td>
                          <td>{formatDuration(phase.activeSeconds)}</td>
                          <td>{phase.expectedMinutes} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {summaryQuery.data.overrideHistory.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Override history</h3>
                  <ul className="detail-task-list">
                    {summaryQuery.data.overrideHistory.map((entry, index) => (
                      <li key={`${entry.atUtc}-${index}`}>
                        <span>
                          {entry.action.replace(/_/g, " ")} — {entry.fromStage ?? "?"} → {entry.toStage ?? "?"}{" "}
                          by {entry.actor}
                        </span>
                        <span className="text-xs text-muted-foreground">{entry.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </QueryState>
      )}
    </section>
  );
}
