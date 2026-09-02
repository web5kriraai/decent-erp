"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

export type ReleasedDesignForGoLive = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  productType?: { name: string } | null;
  designHead?: { name: string } | null;
  liveReviewCompleted: boolean;
  liveReviewStatus: string | null;
};

export function useApprovedDesigns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.approved,
    queryFn: () =>
      apiGet<
        Array<{
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
        }>
      >("/api/production/release"),
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
