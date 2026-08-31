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
): Array<{ code: string; name: string; seconds: number }> {
  const sorted = sortEvents(events);
  const buckets = new Map<string, { name: string; ms: number }>();
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
      const existing = buckets.get(code) ?? { name, ms: 0 };
      existing.ms += msBetween(holdStart, time);
      buckets.set(code, existing);
      holdStart = null;
      holdReason = null;
    }
  }

  if (holdStart) {
    const code = holdReason?.code ?? "UNKNOWN";
    const name = holdReason?.name ?? "Unknown hold";
    const existing = buckets.get(code) ?? { name, ms: 0 };
    existing.ms += msBetween(holdStart, now);
    buckets.set(code, existing);
  }

  return [...buckets.entries()]
    .map(([code, { name, ms }]) => ({ code, name, seconds: Math.floor(ms / 1000) }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function computeTimeSummary(
  events: TimeEventRecord[],
  now: Date = new Date(),
): TimeSummary {
  const sorted = sortEvents(events);
  const activeSeconds = computeActiveSeconds(sorted, now);
  const holdSeconds = computeHoldSeconds(sorted, now);
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
    totalElapsedSeconds,
    holdByReason: computeHoldBreakdown(sorted, now),
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

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}
