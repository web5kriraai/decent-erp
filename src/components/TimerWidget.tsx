"use client";

import { AppButton } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";
import { IconPause, IconPlay, IconSquare } from "@/components/icons";

type TimerWidgetProps = {
  status: "RUNNING" | "ON_HOLD" | "IDLE";
  elapsedSeconds: number;
  taskLabel?: string;
  compact?: boolean;
  onStart?: () => void;
  startDisabled?: boolean;
  startLabel?: string;
  startHint?: string;
  onHold?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function TimerWidget({
  status,
  elapsedSeconds,
  taskLabel,
  compact = false,
  onStart,
  startDisabled = false,
  startLabel = "Start Task",
  startHint,
  onHold,
  onResume,
  onEnd,
}: TimerWidgetProps) {
  const displaySeconds = Math.max(0, Math.floor(elapsedSeconds));

  const isActive = status === "RUNNING" || status === "ON_HOLD";

  return (
    <div
      className={cn(
        "timer-widget",
        compact && "timer-widget--compact",
        status === "RUNNING" && "timer-widget--running",
        status === "ON_HOLD" && "timer-widget--hold",
      )}
    >
      <p className="timer-widget-label">{compact ? "Timer" : "Active Task Timer"}</p>

      <p
        className="timer-display"
        aria-live="polite"
        aria-label={`Elapsed ${formatTime(displaySeconds)}`}
      >
        {formatTime(displaySeconds)}
      </p>

      <span
        className={cn(
          "timer-status",
          status === "RUNNING" && "timer-status--running",
          status === "ON_HOLD" && "timer-status--hold",
        )}
      >
        <span className="timer-status-dot" aria-hidden />
        {status.replace("_", " ")}
      </span>

      {taskLabel ? (
        <p className="timer-task-label" title={taskLabel}>
          {taskLabel}
        </p>
      ) : null}

      <div className="timer-actions">
        {status === "IDLE" && onStart ? (
          <AppButton
            type="button"
            size="sm"
            onClick={onStart}
            disabled={startDisabled}
            aria-label={startLabel}
            title={startHint}
          >
            <IconPlay aria-hidden />
            {startLabel}
          </AppButton>
        ) : null}
        {status === "RUNNING" && onHold ? (
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            onClick={onHold}
            aria-label="Hold Task"
          >
            <IconPause aria-hidden />
            Hold Task
          </AppButton>
        ) : null}
        {status === "ON_HOLD" && onResume ? (
          <AppButton type="button" size="sm" onClick={onResume} aria-label="Resume Task">
            <IconPlay aria-hidden />
            Resume Task
          </AppButton>
        ) : null}
        {isActive && onEnd ? (
          <AppButton type="button" appVariant="danger" size="sm" onClick={onEnd} aria-label="End Task">
            <IconSquare aria-hidden />
            End Task
          </AppButton>
        ) : null}
        {status === "IDLE" && onStart && startHint ? (
          <p className="timer-idle-hint">{startHint}</p>
        ) : null}
        {status === "IDLE" && !onStart ? (
          <p className="timer-idle-hint">Start a task from the board to begin tracking time.</p>
        ) : null}
      </div>
    </div>
  );
}
