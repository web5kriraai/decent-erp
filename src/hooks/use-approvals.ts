"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  ApprovalLevel,
  PendingApproval,
  PendingApprovalQueueItem,
  ReadyForSignOffItem,
  StageApprovalQueueItem,
} from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

const APPROVALS_REFETCH_MS = 30_000;

export type SubmitApprovalPayload = {
  designId: string;
  taskId?: string;
  approvalLevelId: number;
  decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED" | "SKIPPED";
  remark?: string;
};

export type PendingApprovalItem = PendingApprovalQueueItem;

export type ApprovalsHubData = {
  stageApprovals: StageApprovalQueueItem[];
  managementApprovals: PendingApprovalItem[];
  readyForSignOff: ReadyForSignOffItem[];
};

export function useApprovalsHub(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals.hub,
    queryFn: () => apiGet<ApprovalsHubData>("/api/approvals?view=hub"),
    enabled,
    refetchInterval: APPROVALS_REFETCH_MS,
  });
}

export function usePendingApprovals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals.pending,
    queryFn: () => apiGet<PendingApprovalItem[]>("/api/approvals"),
    enabled,
    refetchInterval: APPROVALS_REFETCH_MS,
  });
}

export function useStageApprovals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals.stage,
    queryFn: () => apiGet<StageApprovalQueueItem[]>("/api/approvals?view=stage"),
    enabled,
    refetchInterval: APPROVALS_REFETCH_MS,
  });
}

export function useReadyForSignOff(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals.ready,
    queryFn: () => apiGet<ReadyForSignOffItem[]>("/api/approvals?view=ready"),
    enabled,
    refetchInterval: APPROVALS_REFETCH_MS,
  });
}

export function useApprovalLevels(enabled = true) {
  return useQuery({
    queryKey: queryKeys.approvals.levels,
    queryFn: () => apiGet<ApprovalLevel[]>("/api/approvals?view=levels"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useSubmitApproval() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: SubmitApprovalPayload) =>
      apiPost<PendingApproval>("/api/approvals", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.designHead });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.management });
      toast.success("Approval recorded");
    },
    onError: (error) => toast.errorFromApi(error, "Could not submit approval"),
  });
}

export function useRequestDesignApproval() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (designId: string) =>
      apiPost<{ id: string; status: string }>(`/api/designs/${designId}/request-approval`, {}),
    onSuccess: (_, designId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.designHead });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.management });
      toast.success("Approval requested", "Design is now pending approval");
    },
    onError: (error) => toast.errorFromApi(error, "Could not request approval"),
  });
}
