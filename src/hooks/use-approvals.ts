"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
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

export function useSubmitApproval() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: SubmitApprovalPayload) =>
      apiPost<PendingApproval>("/api/approvals", payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.designHead });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.management });
      if (result.chainComplete || result.designStatus === "APPROVED") {
        toast.success("Final approval complete", "Design is approved and ready for production handoff.");
      } else if (result.nextLevel) {
        toast.success(
          `${result.level?.name ?? "Level"} approved`,
          `Next in chain: ${result.nextLevel.name}. Open Review again to continue.`,
        );
      } else if (result.decision === "REJECTED") {
        toast.success("Design rejected");
      } else if (result.decision === "CORRECTION_REQUIRED") {
        toast.success("Sent for correction", "Design returned to active workflow.");
      } else {
        toast.success("Approval recorded");
      }
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
