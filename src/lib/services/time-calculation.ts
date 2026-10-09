export type TimeEventRecord = {
  eventType: string;
  eventTimeUtc: Date | string;
  holdReasonId?: number | null;
  holdReason?: {
    code: string;
    name?: string;
    excludeFromActiveTime?: boolean;
  } | null;
};

export type TimeSummary = {
  activeSeconds: number;
  holdSeconds: number;
  /** Hold seconds where holdReason.excludeFromActiveTime is true (or unset). */
  excludedHoldSeconds: number;
  /** Hold seconds where holdReason.excludeFromActiveTime is explicitly false. */
  nonExcludedHoldSeconds: number;
  totalElapsedSeconds: number;
  holdByReason: Array<{ code: string; name: string; seconds: number }>;
};

function sortEvents(events: TimeEventRecord[]): TimeEventRecord[] {
  return [...events].sort(
    (a, b) => new Date(a.eventTimeUtc).getTime() - new Date(b.eventTimeUtc).getTime(),
  );
}

function msBetween(start: Date, end: Date): number {
  return Math.max(0, end.getTime() - start.getTime());
}

/** Active work = START/RESUME → HOLD/END intervals */
export function computeActiveSeconds(
  events: TimeEventRecord[],
  now: Date = new Date(),
): number {
  const sorted = sortEvents(events);
  let totalMs = 0;
  let segmentStart: Date | null = null;

  for (const event of sorted) {
    const time = new Date(event.eventTimeUtc);
    if (event.eventType === "START" || event.eventType === "RESUME") {
      segmentStart = time;
    } else if (
      (event.eventType === "HOLD" || event.eventType === "END") &&
      segmentStart
    ) {
      totalMs += msBetween(segmentStart, time);
      segmentStart = null;
    }
  }

  if (segmentStart) {
    totalMs += msBetween(segmentStart, now);
  }

  return Math.floor(totalMs / 1000);
}

/** Hold time = HOLD → RESUME/END intervals */
export function computeHoldSeconds(
  events: TimeEventRecord[],
  now: Date = new Date(),
): number {
  const sorted = sortEvents(events);
  let totalMs = 0;
  let holdStart: Date | null = null;

  for (const event of sorted) {
    const time = new Date(event.eventTimeUtc);
    if (event.eventType === "HOLD") {
      holdStart = time;
    } else if (holdStart && (event.eventType === "RESUME" || event.eventType === "END")) {
      totalMs += msBetween(holdStart, time);
      holdStart = null;
    }
  }

  if (holdStart) {
    totalMs += msBetween(holdStart, now);
  }

  return Math.floor(totalMs / 1000);
}

export function computeHoldBreakdown(
  events: TimeEventRecord[],
  now: Date = new Date(),
): Array<{
  code: string;
  name: string;
  seconds: number;
  excludeFromActiveTime: boolean;
}> {
  const sorted = sortEvents(events);
  const buckets = new Map<
    string,
    { name: string; ms: number; excludeFromActiveTime: boolean }
  >();
  let holdStart: Date | null = null;
  let holdReason: TimeEventRecord["holdReason"] = null;

  for (const event of sorted) {
    const time = new Date(event.eventTimeUtc);
    if (event.eventType === "HOLD") {
      holdStart = time;
      holdReason = event.holdReason ?? null;
    } else if (holdStart && (event.eventType === "RESUME" || event.eventType === "END")) {
      const code = holdReason?.code ?? "UNKNOWN";
      const name = holdReason?.name ?? "Unknown hold";
      const excludeFromActiveTime = holdReason?.excludeFromActiveTime !== false;
      const existing = buckets.get(code) ?? { name, ms: 0, excludeFromActiveTime };
      existing.ms += msBetween(holdStart, time);
      buckets.set(code, existing);
      holdStart = null;
      holdReason = null;
    }
  }

  if (holdStart) {
    const code = holdReason?.code ?? "UNKNOWN";
    const name = holdReason?.name ?? "Unknown hold";
    const excludeFromActiveTime = holdReason?.excludeFromActiveTime !== false;
    const existing = buckets.get(code) ?? { name, ms: 0, excludeFromActiveTime };
    existing.ms += msBetween(holdStart, now);
    buckets.set(code, existing);
  }

  return [...buckets.entries()]
    .map(([code, { name, ms, excludeFromActiveTime }]) => ({
      code,
      name,
      seconds: Math.floor(ms / 1000),
      excludeFromActiveTime,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function computeTimeSummary(
  events: TimeEventRecord[],
  now: Date = new Date(),
): TimeSummary {
  const sorted = sortEvents(events);
  const activeSeconds = computeActiveSeconds(sorted, now);
  const holdSeconds = computeHoldSeconds(sorted, now);
  const holdByReason = computeHoldBreakdown(sorted, now);
  const excludedHoldSeconds = holdByReason
    .filter((h) => h.excludeFromActiveTime)
    .reduce((sum, h) => sum + h.seconds, 0);
  const nonExcludedHoldSeconds = holdByReason
    .filter((h) => !h.excludeFromActiveTime)
    .reduce((sum, h) => sum + h.seconds, 0);
  const firstStart = sorted.find((e) => e.eventType === "START");
  const lastEnd = [...sorted].reverse().find((e) => e.eventType === "END");

  let totalElapsedSeconds = activeSeconds + holdSeconds;
  if (firstStart) {
    const end = lastEnd ? new Date(lastEnd.eventTimeUtc) : now;
    totalElapsedSeconds = Math.floor(msBetween(new Date(firstStart.eventTimeUtc), end) / 1000);
  }

  return {
    activeSeconds,
    holdSeconds,
    excludedHoldSeconds,
    nonExcludedHoldSeconds,
    totalElapsedSeconds,
    holdByReason: holdByReason.map(({ code, name, seconds }) => ({ code, name, seconds })),
  };
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Active-work units. A day is 8 hours, a week is 6 days, a month is 4 weeks. */
const WORK_HOUR_SECONDS = 60 * 60;
const WORK_DAY_SECONDS = 8 * WORK_HOUR_SECONDS;
const WORK_WEEK_SECONDS = 6 * WORK_DAY_SECONDS;
const WORK_MONTH_SECONDS = 4 * WORK_WEEK_SECONDS;

/**
 * Active time in the largest unit that fits.
 * 55 min stays "55 min". 60 min becomes "1 hr". A remainder is kept in the next unit.
 * A day is 8 hours, a week is 6 days, and a month is 4 weeks.
 */
export function formatWorkingTotals(totalSeconds: number): string {
  let remaining = Math.max(0, Math.floor(totalSeconds));
  const units: Array<[number, string]> = [
    [WORK_MONTH_SECONDS, "mo"],
    [WORK_WEEK_SECONDS, "wk"],
    [WORK_DAY_SECONDS, "day"],
    [WORK_HOUR_SECONDS, "hr"],
    [60, "min"],
  ];
  const parts: string[] = [];
  for (const [size, label] of units) {
    if (remaining < size) continue;
    const count = Math.floor(remaining / size);
    remaining -= count * size;
    parts.push(`${count} ${label}`);
  }
  return parts.length > 0 ? parts.join(" ") : "0 min";
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}
