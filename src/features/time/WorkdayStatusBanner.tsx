"use client";

import { AppButton } from "@/components/ui/AppButton";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useMyTimeSummary } from "@/hooks/use-time";
import { formatDuration } from "@/lib/services/time-calculation";

/** Shown only after today's workday has been closed. An open day needs no warning. */
export function WorkdayStatusBanner({ showOpenAction = true }: { showOpenAction?: boolean }) {
  const summaryQuery = useMyTimeSummary();
  const { openWorkday } = useTaskMutations();
  const data = summaryQuery.data;
  if (!data?.workdayClosed) return null;

  const worked = data.totals.activeSeconds + data.totals.holdSeconds > 0;
  const timeLabel = `Active ${formatDuration(data.totals.activeSeconds)} · Hold ${formatDuration(data.totals.holdSeconds)}`;

  return (
    <div className="alert alert-warning workday-status" role="status">
      <div className="min-w-0">
        <p className="workday-status__title">Workday is closed</p>
        <p className="workday-status__text">
          {worked
            ? `Time already recorded today: ${timeLabel}. Open the workday to start again.`
            : "No time is recorded today because the workday is closed. Open it before you start a task."}
        </p>
      </div>
      {showOpenAction ? (
        <AppButton
          type="button"
          size="sm"
          disabled={openWorkday.isPending}
          onClick={() => openWorkday.mutate()}
        >
          {openWorkday.isPending ? "Opening…" : "Open Workday"}
        </AppButton>
      ) : null}
    </div>
  );
}
