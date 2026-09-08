import {
  computeActiveSeconds,
  type TimeEventRecord,
} from "@/lib/services/time-calculation";

export type CorrectionTimeBreakdown = {
  employeeId: number | null;
  originalActiveSeconds: number;
  reworkActiveSeconds: number;
  totalActiveSeconds: number;
  measuredExtraMinutes: number;
};

function filterEventsBefore(
  events: TimeEventRecord[],
  cutoff: Date,
): TimeEventRecord[] {
  const t = cutoff.getTime();
  return events.filter((e) => new Date(e.eventTimeUtc).getTime() < t);
}

function filterEventsOnOrAfter(
  events: TimeEventRecord[],
  cutoff: Date,
): TimeEventRecord[] {
  const t = cutoff.getTime();
  return events.filter((e) => new Date(e.eventTimeUtc).getTime() >= t);
}

/**
 * Prior work + rework active time for a correction loop.
 * - original: events on source taskId for employee before correction created
 * - rework: events on routedTaskId (fallback source) for employee on/after created
 * When same task is reopened, both windows use that taskId.
 */
export function computeCorrectionTimeBreakdown(input: {
  createdAtUtc: Date | string;
  sourceTaskEvents: TimeEventRecord[];
  routedTaskEvents?: TimeEventRecord[];
  employeeId?: number | null;
  now?: Date;
}): CorrectionTimeBreakdown {
  const cutoff = new Date(input.createdAtUtc);
  const now = input.now ?? new Date();
  const source = input.sourceTaskEvents;
  const routed = input.routedTaskEvents ?? source;

  const originalActiveSeconds = computeActiveSeconds(
    filterEventsBefore(source, cutoff),
    cutoff,
  );
  const reworkActiveSeconds = computeActiveSeconds(
    filterEventsOnOrAfter(routed, cutoff),
    now,
  );
  const totalActiveSeconds = originalActiveSeconds + reworkActiveSeconds;

  return {
    employeeId: input.employeeId ?? null,
    originalActiveSeconds,
    reworkActiveSeconds,
    totalActiveSeconds,
    measuredExtraMinutes: Math.ceil(reworkActiveSeconds / 60),
  };
}

export function formatActiveDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}
