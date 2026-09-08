"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignKpiContribution, EmployeePerformanceResponse } from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

export function useDesignKpiContribution(designId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.designs.kpiContribution(designId),
    queryFn: () =>
      apiGet<{ contributors: DesignKpiContribution[] }>(
        `/api/designs/${designId}/kpi-contribution`,
      ),
    enabled: enabled && !!designId,
    refetchInterval: enabled ? 30_000 : false,
  });
}

export function useSubmitCreativityRating(designId: string) {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  return useMutation({
    mutationFn: (payload: { employeeId: number; score: number; remark?: string | null }) =>
      apiPost(`/api/designs/${designId}/creativity-ratings`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.kpiContribution(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.employeesRoot });
      toast.success("Creativity rating saved");
    },
    onError: (error) => toast.errorFromApi(error, "Failed to save creativity rating"),
  });
}

export function useEmployeePerformance(
  employeeId: number | null,
  enabled = true,
  period?: { year?: number; month?: number },
) {
  return useQuery({
    queryKey: queryKeys.kpi.performance(employeeId ?? 0, period?.year, period?.month),
    queryFn: () => {
      const params = new URLSearchParams();
      if (period?.year) params.set("year", String(period.year));
      if (period?.month) params.set("month", String(period.month));
      const q = params.toString();
      return apiGet<EmployeePerformanceResponse>(
        `/api/kpi/employees/${employeeId}/performance${q ? `?${q}` : ""}`,
      );
    },
    enabled: enabled && employeeId != null && employeeId > 0,
  });
}

/** Plan aliases */
export const useDesignContribution = useDesignKpiContribution;
export const useCreativityRating = useSubmitCreativityRating;
