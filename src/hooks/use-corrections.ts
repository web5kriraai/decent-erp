"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { CorrectionRecord, EmployeeOption } from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

export type RaiseCorrectionPayload = {
  designId: string;
  taskId: string;
  correctionType:
    | "MISTAKE"
    | "IMPROVEMENT"
    | "CUSTOMER_CHANGE"
    | "MACHINE"
    | "MATERIAL"
    | "OTHER";
  responsibleEmployeeId?: number | null;
  routeToSubProcessId?: number | null;
  rootCause?: string;
  extraMinutes?: number;
  extraCost?: number;
};

export function useCorrections(
  filters?: { designId?: string; mine?: boolean; status?: string },
  enabled = true,
) {
  const params = new URLSearchParams();
  if (filters?.designId) params.set("designId", filters.designId);
  if (filters?.mine) params.set("mine", "1");
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.corrections.list(filters),
    queryFn: () => apiGet<CorrectionRecord[]>(`/api/corrections${qs ? `?${qs}` : ""}`),
    enabled,
  });
}

export function useEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.employees,
    queryFn: () =>
      apiGet<Array<EmployeeOption & { role: { code: string; name: string } }>>(
        "/api/masters/employees",
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useRaiseCorrection() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: RaiseCorrectionPayload) =>
      apiPost<CorrectionRecord>("/api/corrections", payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corrections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.detail(variables.designId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      toast.success("Correction raised", "Responsible employee has been notified");
    },
    onError: (error) => toast.errorFromApi(error, "Could not raise correction"),
  });
}

export function useUpdateCorrectionStatus() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "CHECKING" | "DONE" | "REJECTED";
    }) => apiPatch<CorrectionRecord>(`/api/corrections/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.corrections.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.designs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Correction updated");
    },
    onError: (error) => toast.errorFromApi(error, "Could not update correction"),
  });
}
