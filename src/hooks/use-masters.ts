"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { HoldReason, ProductType, Season, WorkflowPattern } from "@/lib/types/api";

export function useWorkflowPatterns(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.workflowPatterns,
    queryFn: () => apiGet<WorkflowPattern[]>("/api/workflow-patterns"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useHoldReasons(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.holdReasons,
    queryFn: () => apiGet<HoldReason[]>("/api/masters/hold-reasons"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useProductTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.productTypes,
    queryFn: () => apiGet<ProductType[]>("/api/masters/product-types"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useSeasons(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.seasons,
    queryFn: () => apiGet<Season[]>("/api/masters/seasons"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export type ComponentTypeMaster = {
  id: number;
  code: string;
  name: string;
  productTypeId?: number | null;
  sequence: number;
  active: boolean;
};

export function useComponentTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.componentTypes,
    queryFn: () => apiGet<ComponentTypeMaster[]>("/api/masters/component-types"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export type ChecklistItemMaster = {
  id: number;
  code: string;
  name: string;
  sequence: number;
  active: boolean;
  subProcessId?: number | null;
  subProcess?: { id: number; code: string; name: string } | null;
};

export function useChecklistItems(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.checklistItems,
    queryFn: () => apiGet<ChecklistItemMaster[]>("/api/masters/checklist"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

type ProcessMaster = {
  id: number;
  code: string;
  name: string;
  sequence: number;
  subProcesses: Array<{
    id: number;
    name: string;
    code: string;
    sequence: number;
    defaultRoleId?: number | null;
  }>;
};

export function useProcessMasters(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.processes,
    queryFn: () => apiGet<ProcessMaster[]>("/api/masters/processes"),
    enabled,
    staleTime: 5 * 60_000,
  });
}
