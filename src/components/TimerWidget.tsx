"use client";

import { useEffect, useState } from "react";

type TimerWidgetProps = {
  status: "RUNNING" | "ON_HOLD" | "IDLE";
  elapsedSeconds: number;
  taskLabel?: string;
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
  onHold,
  onResume,
  onEnd,
}: TimerWidgetProps) {
  const [displaySeconds, setDisplaySeconds] = useState(elapsedSeconds);

  useEffect(() => {
    setDisplaySeconds(elapsedSeconds);
    if (status !== "RUNNING") return;

    const startedAt = Date.now();
    const base = elapsedSeconds;
    const id = window.setInterval(() => {
      setDisplaySeconds(base + Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [elapsedSeconds, status]);

  const widgetClass =
    status === "RUNNING"
      ? "timer-widget timer-widget--running"
      : status === "ON_HOLD"
        ? "timer-widget timer-widget--hold"
        : "timer-widget";

  const statusColor =
    status === "RUNNING"
      ? "var(--color-success)"
      : status === "ON_HOLD"
        ? "var(--color-warning)"
        : "var(--color-neutral-500)";

  return (
    <div className={widgetClass}>
      <p
        style={{
          margin: 0,
          fontSize: "var(--font-size-caption)",
          color: "var(--color-neutral-500)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Active Task Timer
      </p>
      <p className="timer-display" aria-live="polite" aria-label={`Elapsed ${formatTime(displaySeconds)}`}>
        {formatTime(displaySeconds)}
      </p>
      <span className="timer-status" style={{ color: statusColor }}>
        <span className="badge-dot" style={{ background: statusColor }} />
        {status.replace("_", " ")}
      </span>
      {taskLabel && (
        <p style={{ margin: "0.75rem 0 0", fontSize: "var(--font-size-body)", color: "var(--color-neutral-700)" }}>
          {taskLabel}
        </p>
      )}
      <div className="timer-actions">
        {status === "RUNNING" && onHold && (
          <button type="button" className="btn btn-secondary" onClick={onHold} aria-label="Hold task">
            Hold
          </button>
        )}
        {status === "ON_HOLD" && onResume && (
          <button type="button" className="btn btn-primary" onClick={onResume} aria-label="Resume task">
            Resume
          </button>
        )}
        {(status === "RUNNING" || status === "ON_HOLD") && onEnd && (
          <button type="button" className="btn btn-danger" onClick={onEnd} aria-label="End task">
            End Task
          </button>
        )}
        {status === "IDLE" && (
          <p style={{ margin: 0, fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
            Start a task from the list to begin tracking time
          </p>
        )}
      </div>
    </div>
  );
}
