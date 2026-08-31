"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignListResponse, DesignSummary, CreateDesignPayload } from "@/lib/types/api";
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

export function useCreateDesign() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: CreateDesignPayload) =>
      apiPost<DesignSummary>("/api/designs", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(data.id) });
      toast.success("Design updated");
    },
    onError: (error) => toast.errorFromApi(error, "Failed to update design"),
  });
}
