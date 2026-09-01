"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react";

type TimerWidgetProps = {
  status: "RUNNING" | "ON_HOLD" | "IDLE";
  elapsedSeconds: number;
  taskLabel?: string;
  compact?: boolean;
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
  onHold,
  onResume,
  onEnd,
}: TimerWidgetProps) {
  const [runningOffset, setRunningOffset] = useState(0);

  useEffect(() => {
    if (status !== "RUNNING") return;

    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setRunningOffset(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      window.clearInterval(id);
      setRunningOffset(0);
    };
  }, [elapsedSeconds, status]);

  const displaySeconds =
    status === "RUNNING" ? elapsedSeconds + runningOffset : elapsedSeconds;

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
      <p className="timer-widget-label">Active Task Timer</p>

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
        {status === "RUNNING" && onHold ? (
          <Button type="button" variant="outline" size="sm" onClick={onHold}>
            <PauseIcon />
            Hold
          </Button>
        ) : null}
        {status === "ON_HOLD" && onResume ? (
          <Button type="button" size="sm" onClick={onResume}>
            <PlayIcon />
            Resume
          </Button>
        ) : null}
        {isActive && onEnd ? (
          <Button type="button" variant="destructive" size="sm" onClick={onEnd}>
            <SquareIcon />
            End Task
          </Button>
        ) : null}
        {status === "IDLE" ? (
          <p className="timer-idle-hint">Start a task from the board to begin tracking time.</p>
        ) : null}
      </div>
    </div>
  );
}
