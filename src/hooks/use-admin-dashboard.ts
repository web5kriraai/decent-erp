"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type AdminDashboardStats = {
  totalIdeas: number;
  underDevelopment: number;
  correctionsOpen: number;
  approved: number;
  released: number;
  averageLeadTimeDays: number;
};

export function useAdminDashboardStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: () => apiGet<AdminDashboardStats>("/api/admin/dashboard"),
    enabled,
    staleTime: 60_000,
  });
}
