import type { TaskTimeEvent, TimeSummary } from "@/lib/types/api";
import { formatDuration } from "@/lib/services/time-calculation";

type TaskTimeTimelineProps = {
  events: TaskTimeEvent[];
  summary?: TimeSummary;
};

const EVENT_LABELS: Record<string, string> = {
  START: "Started",
  HOLD: "On hold",
  RESUME: "Resumed",
  END: "Completed",
  OFFICE_CLOSE: "Workday closed",
  ADMIN_ADJUSTMENT: "Admin adjustment",
};

export function TaskTimeTimeline({ events, summary }: TaskTimeTimelineProps) {
  if (events.length === 0) {
    return (
      <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>
        No time events recorded yet. Start the task to begin server-tracked timing.
      </p>
    );
  }

  return (
    <div className="time-timeline-wrap">
      {summary && (
        <div className="time-metric-grid stack-section-sm">
          <TimeMetric label="Active work" value={formatDuration(summary.activeSeconds)} accent />
          <TimeMetric label="Hold time" value={formatDuration(summary.holdSeconds)} />
          <TimeMetric label="Total elapsed" value={formatDuration(summary.totalElapsedSeconds)} />
        </div>
      )}

      <ol className="time-timeline">
        {events.map((event, index) => (
          <li key={event.id ?? `${event.eventType}-${index}`} className="time-timeline-item">
            <span className={`time-timeline-dot time-timeline-dot--${event.eventType.toLowerCase()}`} />
            <div className="time-timeline-content">
              <div className="time-timeline-header">
                <strong>{EVENT_LABELS[event.eventType] ?? event.eventType}</strong>
                <time dateTime={event.eventTimeUtc}>
                  {new Date(event.eventTimeUtc).toLocaleString()}
                </time>
              </div>
              {event.holdReason && (
                <p className="time-timeline-meta">
                  Reason: {event.holdReason.name}
                  {event.holdReason.code ? ` (${event.holdReason.code})` : ""}
                </p>
              )}
              {event.remark && <p className="time-timeline-remark">{event.remark}</p>}
            </div>
          </li>
        ))}
      </ol>

      {summary && summary.holdByReason.length > 0 && (
        <div className="time-hold-breakdown">
          <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "var(--font-size-body)" }}>Hold breakdown</h4>
          <ul className="detail-task-list">
            {summary.holdByReason.map((h) => (
              <li key={h.code}>
                <span>{h.name}</span>
                <span>{formatDuration(h.seconds)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TimeMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`time-metric ${accent ? "time-metric--accent" : ""}`}>
      <span className="time-metric-label">{label}</span>
      <span className="time-metric-value">{value}</span>
    </div>
  );
}

export function TimeMetricGrid({
  activeSeconds,
  holdSeconds,
  totalElapsedSeconds,
  extra,
}: {
  activeSeconds: number;
  holdSeconds: number;
  totalElapsedSeconds: number;
  extra?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="time-metric-grid">
      <TimeMetric label="Active work" value={formatDuration(activeSeconds)} accent />
      <TimeMetric label="Hold time" value={formatDuration(holdSeconds)} />
      <TimeMetric label="Total elapsed" value={formatDuration(totalElapsedSeconds)} />
      {extra?.map((item) => (
        <TimeMetric key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
