"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignTask } from "@/lib/types/api";
import { ApiClientError } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";

export type ActionCenterWaitingItem = {
  taskId: string;
  design: { id: string; ideaRef: string; collectionName: string };
  myStage: string;
  myStatus: string;
  waitingFor: string;
  nextAction: string;
  nextTaskId?: string;
};

export type ActionCenterBlockedItem = {
  taskId: string;
  design: { id: string; ideaRef: string; collectionName: string };
  stage: string;
  status: string;
  blockedBy: string;
  blockedOwner?: string;
  blockedMessage: string;
};

export type ActionCenterData = {
  actionRequired: DesignTask[];
  waitingForOthers: ActionCenterWaitingItem[];
  blocked: ActionCenterBlockedItem[];
  upcoming: DesignTask[];
  completed: DesignTask[];
};

export function useActionCenter(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.actionCenter,
    queryFn: () => apiGet<ActionCenterData>("/api/tasks/action-center"),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunning = data?.actionRequired?.some((t) => t.status === "RUNNING");
      return hasRunning ? 15_000 : false;
    },
  });
}

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
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
    queryClient.invalidateQueries({ queryKey: ["tasks", "detail"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
    queryClient.invalidateQueries({ queryKey: ["designs", "detail"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.time.mySummary });
    queryClient.invalidateQueries({ queryKey: queryKeys.time.live });
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
      checklist,
      checklistNote,
      sampleOutcome,
    }: {
      taskId: string;
      version: number;
      outputRemark: string;
      completionStatus: "COMPLETED" | "CHECKING";
      checklist?: Array<{ itemId: number; result: boolean; remark?: string }>;
      checklistNote?: string;
      sampleOutcome?: "APPROVE" | "REJECT" | "RESAMPLE";
    }) =>
      apiPost<DesignTask>(`/api/tasks/${taskId}/end`, {
        version,
        outputRemark,
        completionStatus,
        checklist,
        checklistNote,
        sampleOutcome,
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
    onSuccess: () => {
      invalidate();
      toast.success("Workday closed");
    },
    onError: (error) => toast.errorFromApi(error, "Cannot close workday"),
  });

  return { start, hold, resume, end, closeWorkday, isPending: start.isPending || hold.isPending || resume.isPending || end.isPending };
}

export function useCompleteStageApproval() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({
      taskId,
      version,
      outputRemark,
    }: {
      taskId: string;
      version: number;
      outputRemark: string;
    }) =>
      apiPost<DesignTask>(`/api/tasks/${taskId}/approve-stage`, {
        version,
        outputRemark,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
      queryClient.invalidateQueries({ queryKey: ["tasks", "detail"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: ["designs", "detail"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.time.mySummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.time.live });
      toast.success("Stage approved");
    },
    onError: (error) => {
      toast.errorFromApi(error, "Could not approve stage");
    },
  });
}

export function useAssignTask() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({ taskId, employeeId }: { taskId: string; employeeId: number }) =>
      apiPatch<DesignTask>(`/api/tasks/${taskId}/assign`, { employeeId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: ["designs", "detail"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
      toast.success("Task assigned", data.assignedEmployee?.name ?? "Employee updated");
    },
    onError: (error) => toast.errorFromApi(error, "Could not assign task"),
  });
}
