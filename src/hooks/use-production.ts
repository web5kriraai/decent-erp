"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

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
        }>
      >("/api/production/release"),
    enabled,
  });
}

export function useReleaseToProduction() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (designId: string) =>
      apiPost<{ id: string; ideaRef: string; status: string }>("/api/production/release", {
        designId,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.production.approved });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      toast.success("Released to production", data.ideaRef);
    },
    onError: (error) => toast.errorFromApi(error, "Could not release design"),
  });
}
