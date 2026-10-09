"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeTimeSummary,
  type TimeEventRecord,
  type TimeSummary,
} from "@/lib/services/time-calculation";

/**
 * Recompute active and hold time from the server event timestamps.
 * While the task is running or on hold, the open segment grows every second
 * instead of staying at the value from the last API response.
 */
export function useLiveTimeSummary(
  events: TimeEventRecord[] | undefined,
  ticking: boolean,
): TimeSummary | null {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  return useMemo(() => {
    if (!events) return null;
    return computeTimeSummary(events, new Date(nowMs));
  }, [events, nowMs]);
}
