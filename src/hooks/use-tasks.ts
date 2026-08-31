"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignTask } from "@/lib/types/api";
import { ApiClientError } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";

export function useMyTasks(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.my,
    queryFn: () => apiGet<DesignTask[]>("/api/tasks/my"),
    enabled,
    refetchInterval: (query) => {
      const tasks = query.state.data;
      const hasRunning = tasks?.some((t) => t.status === "RUNNING");
      return hasRunning ? 15_000 : false;
    },
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
    queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
  };

  const start = useMutation({
    mutationFn: (taskId: string) => apiPost<DesignTask>(`/api/tasks/${taskId}/start`),
    onSuccess: () => {
      invalidate();
      toast.success("Task started", "Timer is now running on the server");
    },
    onError: (error) => {
      toast.errorFromApi(error, "Cannot start task");
      if (error instanceof ApiClientError && error.isConflict) {
        invalidate();
      }
    },
  });

  const hold = useMutation({
    mutationFn: ({
      taskId,
      holdReasonId,
      remark,
    }: {
      taskId: string;
      holdReasonId: number;
      remark?: string;
    }) => apiPost<DesignTask>(`/api/tasks/${taskId}/hold`, { holdReasonId, remark }),
    onSuccess: () => {
      invalidate();
      toast.success("Task on hold");
    },
    onError: (error) => toast.errorFromApi(error, "Cannot hold task"),
  });

  const resume = useMutation({
    mutationFn: (taskId: string) => apiPost<DesignTask>(`/api/tasks/${taskId}/resume`),
    onSuccess: () => {
      invalidate();
      toast.success("Task resumed");
    },
    onError: (error) => toast.errorFromApi(error, "Cannot resume task"),
  });

  const end = useMutation({
    mutationFn: ({
      taskId,
      version,
      outputRemark,
      completionStatus,
    }: {
      taskId: string;
      version: number;
      outputRemark: string;
      completionStatus: "COMPLETED" | "CHECKING";
    }) =>
      apiPost<DesignTask>(`/api/tasks/${taskId}/end`, {
        version,
        outputRemark,
        completionStatus,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Task completed");
    },
    onError: (error) => {
      toast.errorFromApi(error, "Cannot end task");
      if (error instanceof ApiClientError && error.isConflict) {
        invalidate();
      }
    },
  });

  const closeWorkday = useMutation({
    mutationFn: () => apiPost<{ closed: boolean }>("/api/workday/close"),
    onSuccess: () => toast.success("Workday closed"),
    onError: (error) => toast.errorFromApi(error, "Cannot close workday"),
  });

  return { start, hold, resume, end, closeWorkday, isPending: start.isPending || hold.isPending || resume.isPending || end.isPending };
}
