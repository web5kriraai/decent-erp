"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { EmployeeTimeSummary, LiveTeamTimeRow, TaskTimeDetail } from "@/lib/types/api";

type TimeReportRow = {
  employeeId: number;
  name: string;
  employeeCode: string;
  role: { code: string; name: string };
  tasksWorked: number;
  tasksCompleted: number;
  workdaysClosed: number;
  activeSeconds: number;
  holdSeconds: number;
  totalElapsedSeconds: number;
  holdByReason: Array<{ code: string; name: string; seconds: number }>;
};

export function useMyTimeSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.time.mySummary,
    queryFn: () => apiGet<EmployeeTimeSummary>("/api/time/my-summary"),
    enabled,
    refetchInterval: (query) => {
      const hasRunning = query.state.data?.currentTask?.status === "RUNNING";
      return hasRunning ? 15_000 : 60_000;
    },
  });
}

export function useLiveTeamTime(enabled = true) {
  return useQuery({
    queryKey: queryKeys.time.live,
    queryFn: () =>
      apiGet<{
        asOfUtc: string;
        runningCount: number;
        onHoldCount: number;
        employees: LiveTeamTimeRow[];
      }>("/api/admin/time/live"),
    enabled,
    refetchInterval: 15_000,
  });
}

export function useTimeReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.time.report(from, to),
    queryFn: () =>
      apiGet<{ from: string; to: string; rows: TimeReportRow[] }>(
        `/api/admin/time/report?from=${from}&to=${to}`,
      ),
    enabled: enabled && !!from && !!to,
  });
}

export function useTaskTimeDetail(taskId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => apiGet<TaskTimeDetail>(`/api/tasks/${taskId}`),
    enabled: enabled && !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "RUNNING" ? 15_000 : false;
    },
  });
}
