"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import type {
  ProductionDeskNextAction,
  ProductionLadderStageSnapshot,
} from "@/lib/services/production-desk-snapshot";

export type ReleasedDesignForGoLive = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  productType?: { name: string } | null;
  designHead?: { name: string } | null;
  liveReviewCompleted: boolean;
  liveReviewStatus: string | null;
  liveReviewTaskId?: string | null;
};

export type ApprovedDesignForProduction = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  productType: { name: string };
  season: { name: string };
  designHead: { name: string };
  costs: unknown[];
  releaseReady: boolean;
  releaseMissing: string[];
  ladderStages: ProductionLadderStageSnapshot[];
  nextAction: ProductionDeskNextAction | null;
};

export function useApprovedDesigns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.approved,
    queryFn: () => apiGet<ApprovedDesignForProduction[]>("/api/production/release"),
    enabled,
  });
}

export function useReleasedDesigns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.released,
    queryFn: () => apiGet<ReleasedDesignForGoLive[]>("/api/production/live"),
    enabled,
  });
}

export function useMarkDesignLive() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (designId: string) =>
      apiPost<{ id: string; ideaRef: string; status: string }>("/api/production/live", {
        designId,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.released });
      queryClient.invalidateQueries({ queryKey: queryKeys.production.handoffs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      toast.success("Design is live", data.ideaRef);
    },
    onError: (error) => toast.errorFromApi(error, "Could not mark design live"),
  });
}

export type ProductionHandoffRow = {
  id: string;
  erpModule: string;
  designNumber: string;
  status: string;
  erpReference: string | null;
  payload?: { error?: string } | null;
  design: { id: string; ideaRef: string; collectionName: string; status: string };
};

export function useProductionHandoffs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.handoffs(),
    queryFn: () => apiGet<ProductionHandoffRow[]>("/api/production/handoffs"),
    enabled,
  });
}

export type ProductionReturnOptions = {
  designId: string;
  ideaRef: string;
  canReturn: boolean;
  reasons: Array<{ code: string; label: string }>;
  routeOptions: Array<{ id: number; code: string; name: string }>;
  instructionStatus: string | null;
};

export function useProductionReturnOptions(designId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.returnOptions(designId),
    queryFn: () =>
      apiGet<ProductionReturnOptions>(
        `/api/production/return?designId=${encodeURIComponent(designId)}`,
      ),
    enabled: enabled && !!designId,
  });
}

export function useProductionReturn() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (body: {
      designId: string;
      reasonCode: string;
      routeToSubProcessId: number;
      remark?: string;
    }) => apiPost<{ correctionId: string }>("/api/production/return", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.inbox });
      queryClient.invalidateQueries({ queryKey: queryKeys.production.approved });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
      queryClient.invalidateQueries({ queryKey: queryKeys.corrections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      toast.success("Returned for clarification", "Design team has been notified.");
    },
    onError: (error) => toast.errorFromApi(error, "Could not return design"),
  });
}

export function useAcceptProductionHandoff() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (designId: string) =>
      apiPost<{ designId: string; instructionTaskId: string }>(
        "/api/production/accept-handoff",
        { designId },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.inbox });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      toast.success(
        "Production handoff accepted",
        "Production instruction is ready on My Tasks.",
      );
      return data;
    },
    onError: (error) => toast.errorFromApi(error, "Could not accept production handoff"),
  });
}

export function useRetryHandoffSync() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (handoffId: string) =>
      apiPost<ProductionHandoffRow>("/api/production/handoffs", { handoffId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.handoffs() });
      toast.success("ERP sync complete", `${data.erpModule} → ${data.erpReference ?? "synced"}`);
    },
    onError: (error) => toast.errorFromApi(error, "ERP sync failed"),
  });
}

export type ErpIntegrationStatus = {
  mode: "simulated" | "live";
  baseUrlConfigured: boolean;
  primaryModules: string[];
  downstreamModules: string[];
  syncOrder: string[];
  message: string;
};

export function useErpIntegrationStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.erpStatus,
    queryFn: () => apiGet<ErpIntegrationStatus>("/api/erp/integration-status"),
    enabled,
  });
}

export function useSyncDesignHandoffs() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (designId: string) =>
      apiPost<Array<{ handoffId: string; status: string; erpModule: string }>>(
        "/api/production/handoffs/sync-design",
        { designId },
      ),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.handoffs() });
      const synced = results.filter((r) => r.status === "SYNCED").length;
      toast.success("ERP sync batch complete", `${synced}/${results.length} modules synced`);
    },
    onError: (error) => toast.errorFromApi(error, "ERP batch sync failed"),
  });
}

export type ErpStageRow = {
  id: string | number | bigint;
  erpModule: string;
  sequence: number;
  status: string;
  qty: number;
  wastageQty: number;
  amount: string | number;
  lotRef: string | null;
  invoiceRef: string | null;
  remark: string | null;
  completedBy?: { id: number; name: string } | null;
};

export type ErpStageChain = {
  designId: string;
  designNumber: string;
  ideaRef: string;
  collectionName: string;
  designStatus: string;
  completedCount: number;
  currentModule: string | null;
  stages: ErpStageRow[];
};

export function useErpStageChains(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.erpStages(),
    queryFn: () => apiGet<ErpStageChain[]>("/api/erp/stages"),
    enabled,
  });
}

export function useBackfillErpStages() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  return useMutation({
    mutationFn: () => apiPost<{ seeded: Array<{ designId: string; count: number }> }>("/api/erp/stages", {
      backfill: true,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.erpStages() });
      toast.success("ERP stages backfilled", `${data.seeded.length} design(s)`);
    },
    onError: (error) => toast.errorFromApi(error, "Could not backfill ERP stages"),
  });
}

export function useEnsureProductionLadder() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  return useMutation({
    mutationFn: (designId?: string) =>
      apiPost<{
        results: Array<{
          designId: string;
          ideaRef: string;
          appended: boolean;
          unlocked: boolean;
        }>;
        appendedCount: number;
        unlockedCount: number;
      }>("/api/production/ensure-ladder", designId ? { designId } : {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.approved });
      queryClient.invalidateQueries({ queryKey: queryKeys.production.inbox });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      toast.success(
        "Production stages ready",
        `${data.appendedCount} ladder(s) added · ${data.unlockedCount} handoff(s) unlocked`,
      );
    },
    onError: (error) => toast.errorFromApi(error, "Could not ensure production stages"),
  });
}

export function useErpStageAction() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  return useMutation({
    mutationFn: (input: {
      stageId: string;
      action: "start" | "complete";
      qty?: number;
      wastageQty?: number;
      amount?: number;
      lotRef?: string;
      invoiceRef?: string;
      remark?: string;
      marginPercent?: number;
    }) =>
      apiPost<ErpStageRow>(`/api/erp/stages/${input.stageId}`, {
        action: input.action,
        qty: input.qty,
        wastageQty: input.wastageQty,
        amount: input.amount,
        lotRef: input.lotRef,
        invoiceRef: input.invoiceRef,
        remark: input.remark,
        marginPercent: input.marginPercent,
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.erpStages() });
      queryClient.invalidateQueries({ queryKey: ["reports", "design-success"] });
      toast.success(
        vars.action === "start" ? "Stage started" : "Stage completed",
        "ERP chain updated",
      );
    },
    onError: (error) => toast.errorFromApi(error, "ERP stage action failed"),
  });
}

