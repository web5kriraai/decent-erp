"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignCostRecord, DesignCostSummary } from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

export function useDesignCosts(designId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.costs.list(designId),
    queryFn: () =>
      apiGet<{ costs: DesignCostRecord[]; summary: DesignCostSummary }>(
        `/api/designs/${designId}/costs`,
      ),
    enabled: enabled && !!designId,
  });
}

export function useAddCostEntry(designId: string) {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: {
      costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION";
      description?: string;
      amount: number;
    }) => apiPost<DesignCostRecord>(`/api/designs/${designId}/costs`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costs.list(designId) });
      toast.success("Cost entry added");
    },
    onError: (error) => toast.errorFromApi(error, "Could not add cost"),
  });
}
