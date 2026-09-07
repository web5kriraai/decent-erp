"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { HoldReason, WorkflowPattern } from "@/lib/types/api";

export function useWorkflowPatterns(enabled = true, includeInactive = false) {
  return useQuery({
    queryKey: [...queryKeys.masters.workflowPatterns, includeInactive ? "all" : "active"],
    queryFn: () =>
      apiGet<WorkflowPattern[]>(
        `/api/workflow-patterns${includeInactive ? "?includeInactive=1" : ""}`,
      ),
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

export type SkillOption = {
  id: number;
  code: string;
  name: string;
  defaultRoleId?: number | null;
};

export function useSkills(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.skills,
    queryFn: () => apiGet<SkillOption[]>("/api/masters/skills"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export type CatalogMaster = {
  id: number;
  code: string;
  name: string;
  active?: boolean;
  isActive?: boolean;
  description?: string | null;
  sortOrder?: number;
  masterType?: string;
};

export function useMasterCatalog(masterType: string, enabled = true, includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.masters.catalog(masterType, includeInactive),
    queryFn: () =>
      apiGet<CatalogMaster[]>(
        `/api/masters/catalog?masterType=${encodeURIComponent(masterType)}${
          includeInactive ? "&includeInactive=1" : ""
        }`,
      ),
    enabled: enabled && !!masterType,
    staleTime: 10 * 60_000,
  });
}

export function useProductTypes(enabled = true) {
  return useMasterCatalog("PRODUCT_CATEGORY", enabled);
}

export function useSeasons(enabled = true) {
  return useMasterCatalog("SEASON", enabled);
}

export type ComponentTypeMaster = {
  id: number;
  code: string;
  name: string;
  productTypeId?: number | null;
  sequence: number;
  active: boolean;
  sortOrder?: number;
};

export function useComponentTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.componentTypes,
    queryFn: async () => {
      const rows = await apiGet<CatalogMaster[]>("/api/masters/component-types");
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        sequence: r.sortOrder ?? 0,
        active: r.active ?? r.isActive ?? true,
      })) as ComponentTypeMaster[];
    },
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
  active?: boolean;
  subProcesses: Array<{
    id: number;
    name: string;
    code: string;
    sequence: number;
    defaultRoleId?: number | null;
    active?: boolean;
    isApproval?: boolean;
    isFileRequired?: boolean;
    isCorrectionAllowed?: boolean;
    capabilities?: unknown;
  }>;
};

export function useProcessMasters(enabled = true, includeInactive = false) {
  return useQuery({
    queryKey: [...queryKeys.masters.processes, includeInactive ? "all" : "active"],
    queryFn: () =>
      apiGet<ProcessMaster[]>(
        `/api/masters/processes${includeInactive ? "?includeInactive=1" : ""}`,
      ),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export type MasterEmployee = {
  id: number;
  name: string;
  employeeCode: string;
  active: boolean;
};

export function useMasterEmployees(enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.employees,
    queryFn: () => apiGet<MasterEmployee[]>("/api/masters/employees"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useFabrics(enabled = true) {
  return useMasterCatalog("FABRIC_QUALITY", enabled);
}

export function useMachines(enabled = true) {
  return useMasterCatalog("MACHINE", enabled);
}

export function useStitchingTypes(enabled = true) {
  return useMasterCatalog("STITCHING_TYPE", enabled);
}

export function useDesignGrades(enabled = true) {
  return useMasterCatalog("DESIGN_GRADE", enabled);
}

export function useCorrectionReasons(enabled = true) {
  return useMasterCatalog("CORRECTION_TYPE", enabled);
}

export type ConceptTargetAttainment = {
  targetCount: number;
  createdCount: number;
  percent: number;
  periodYear: number;
  periodMonth: number;
};

export type ConceptTargetsResponse = {
  periodYear: number;
  periodMonth: number;
  targets: Array<{
    id: number;
    periodYear: number;
    periodMonth: number;
    targetCount: number;
    seasonId?: number | null;
    productTypeId?: number | null;
    note?: string | null;
    season?: { id: number; code: string; name: string } | null;
    productType?: { id: number; code: string; name: string } | null;
  }>;
  attainment: ConceptTargetAttainment;
};

export function useConceptTargets(enabled = true, year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;
  return useQuery({
    queryKey: queryKeys.masters.conceptTargets(y, m),
    queryFn: () =>
      apiGet<ConceptTargetsResponse>(`/api/masters/concept-targets?year=${y}&month=${m}`),
    enabled,
    staleTime: 60_000,
  });
}
