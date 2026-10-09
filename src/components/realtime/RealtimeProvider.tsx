"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const TOPIC_KEYS: Record<string, readonly (readonly unknown[])[]> = {
  designs: [
    queryKeys.designs.all,
    queryKeys.dashboard.designHead,
    queryKeys.dashboard.management,
    queryKeys.admin.dashboard,
    queryKeys.production.inbox,
  ],
  tasks: [queryKeys.tasks.my, queryKeys.tasks.actionCenter, ["tasks", "detail"], ["tasks", "my-day"]],
  approvals: [queryKeys.approvals.all],
  notifications: [queryKeys.notifications.list],
  time: [queryKeys.time.mySummary, queryKeys.time.live],
  kpi: [queryKeys.kpi.employeesRoot, queryKeys.kpi.designHead],
};

const RECONNECT_TOPICS = Object.keys(TOPIC_KEYS);

function invalidateTopics(
  queryClient: ReturnType<typeof useQueryClient>,
  topics: string[],
) {
  for (const topic of topics) {
    const keys = TOPIC_KEYS[topic];
    if (!keys) continue;
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }
}

/** One SSE connection for the signed-in shell. Events refresh cached queries in place. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let retryMs = 1_000;
    let stopped = false;
    let openedOnce = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/events");
      source.onopen = () => {
        if (openedOnce) {
          invalidateTopics(queryClientRef.current, RECONNECT_TOPICS);
        }
        openedOnce = true;
        retryMs = 1_000;
      };
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { topics?: string[] };
          if (data.topics?.length) {
            invalidateTopics(queryClientRef.current, data.topics);
          }
        } catch {
          // Ignore non-JSON comments and heartbeats (they are not onmessage).
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (stopped) return;
        if (retryTimer) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return children;
}
