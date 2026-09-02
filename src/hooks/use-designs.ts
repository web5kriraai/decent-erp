"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignListResponse, DesignSummary, CreateDesignPayload, DesignCompletionSummary, KanbanDesignItem } from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

export function useDesignsList(enabled = true) {
  return useQuery({
    queryKey: queryKeys.designs.all,
    queryFn: () => apiGet<DesignListResponse>("/api/designs"),
    enabled,
  });
}

export function useDesign(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.designs.detail(id),
    queryFn: () => apiGet<DesignSummary>(`/api/designs/${id}`),
    enabled: enabled && !!id,
  });
}

export function useDesignKanban(enabled = true) {
  return useQuery({
    queryKey: queryKeys.designs.kanban,
    queryFn: () => apiGet<KanbanDesignItem[]>("/api/designs/kanban"),
    enabled,
  });
}

export function useCreateDesign() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: CreateDesignPayload) =>
      apiPost<DesignSummary>("/api/designs", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kanban });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      toast.success("Design created", `${data.ideaRef} with tasks generated`);
    },
    onError: (error) => toast.errorFromApi(error, "Failed to create design"),
  });
}

export function useUpdateDesign() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({
      designId,
      ...payload
    }: {
      designId: string;
      version: number;
      collectionName?: string;
      conceptNote?: string;
      styleName?: string;
      workType?: string;
      trendReference?: string;
      celebrityReference?: string;
      priority?: string;
    }) => apiPatch<DesignSummary>(`/api/designs/${designId}`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kanban });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(data.id) });
      toast.success("Design updated");
    },
    onError: (error) => toast.errorFromApi(error, "Failed to update design"),
  });
}

export function useUpdateDesignStatus() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({
      designId,
      status,
      version,
    }: {
      designId: string;
      status: string;
      version: number;
    }) => apiPatch<DesignSummary>(`/api/designs/${designId}/status`, { status, version }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kanban });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(data.id) });
      toast.success("Status updated", data.status.replace(/_/g, " "));
    },
    onError: (error) => toast.errorFromApi(error, "Could not update status"),
  });
}

export function useDesignCompletionSummary(designId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.designs.completionSummary(designId),
    queryFn: () => apiGet<DesignCompletionSummary>(`/api/designs/${designId}/completion-summary`),
    enabled: enabled && !!designId,
  });
}

export function useSendDesignToQc(designId: string) {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: { targetTaskId: string; reason: string; assigneeId?: number }) =>
      apiPost<DesignSummary>(`/api/designs/${designId}/send-qc`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kanban });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.completionSummary(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      toast.success("Sent to QC phase", data.currentStage?.replace(/_/g, " ") ?? "Updated");
    },
    onError: (error) => toast.errorFromApi(error, "Could not send to QC phase"),
  });
}

export function useBypassDesignPhase(designId: string) {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: { targetTaskId: string; reason: string; assigneeId?: number }) =>
      apiPost<DesignSummary>(`/api/designs/${designId}/bypass`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kanban });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.completionSummary(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      toast.success("Workflow bypassed", data.currentStage?.replace(/_/g, " ") ?? "Updated");
    },
    onError: (error) => toast.errorFromApi(error, "Could not bypass workflow"),
  });
}
