"use client";

import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
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
    <AppCard
      className="stack-section"
      title="Completion summary"
      description={
        isComplete
          ? "Work and time recorded for this design across all phases."
          : `${doneCount} of ${progress.total} phases finished — summary unlocks when all phases are complete.`
      }
      headerAction={
        !isComplete ? (
          <StatusBadge status="IN_PROGRESS" label={`${doneCount}/${progress.total}`} />
        ) : null
      }
    >
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
                <h3 className="mb-2 text-sm font-semibold text-foreground">By employee</h3>
                <DataTable
                  columns={[
                    {
                      key: "name",
                      header: "Employee",
                      render: (row) => (
                        <>
                          {row.name}
                          <span className="data-table-subtext">{row.roleName}</span>
                        </>
                      ),
                    },
                    { key: "tasksCompleted", header: "Completed" },
                    { key: "tasksSkippedAsAssignee", header: "Skipped" },
                    {
                      key: "activeSeconds",
                      header: "Active time",
                      render: (row) => formatDuration(row.activeSeconds),
                    },
                    {
                      key: "holdSeconds",
                      header: "Hold time",
                      render: (row) => formatDuration(row.holdSeconds),
                    },
                  ]}
                  rows={summaryQuery.data.employees}
                  getRowKey={(row) => String(row.employeeId)}
                  emptyTitle="No employee time yet"
                  emptyDescription="No per-employee totals for this design."
                />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">By phase</h3>
                <DataTable
                  columns={[
                    {
                      key: "name",
                      header: "Phase",
                      render: (row) => (
                        <>
                          #{row.sequence} {row.name}
                          {row.skipReason ? (
                            <span className="data-table-subtext">{row.skipReason}</span>
                          ) : null}
                        </>
                      ),
                    },
                    {
                      key: "assignee",
                      header: "Assignee",
                      render: (row) => row.assignee?.name ?? "Unassigned",
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (row) => <StatusBadge status={row.status} />,
                    },
                    {
                      key: "activeSeconds",
                      header: "Active time",
                      render: (row) => formatDuration(row.activeSeconds),
                    },
                    {
                      key: "expectedMinutes",
                      header: "Expected",
                      render: (row) => `${row.expectedMinutes} min`,
                    },
                  ]}
                  rows={summaryQuery.data.phases}
                  getRowKey={(row) => row.taskId}
                  emptyTitle="No phases"
                  emptyDescription="No phase breakdown for this design."
                />
              </div>

              {summaryQuery.data.overrideHistory.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Override history</h3>
                  <ul className="detail-task-list">
                    {summaryQuery.data.overrideHistory.map((entry, index) => (
                      <li key={`${entry.atUtc}-${index}`}>
                        <span>
                          {entry.action.replace(/_/g, " ")} — {entry.fromStage ?? "?"} →{" "}
                          {entry.toStage ?? "?"} by {entry.actor}
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
    </AppCard>
  );
}
