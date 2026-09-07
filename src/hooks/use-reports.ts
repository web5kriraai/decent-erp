"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export type CorrectionAnalysisReport = {
  corrections: Array<{
    id: string;
    correctionType: string;
    status: string;
    extraMinutes?: number | null;
    extraCost?: string | number | null;
    design?: { ideaRef: string; collectionName: string } | null;
    task?: { subProcess?: { name: string; code: string } | null } | null;
    responsibleEmployee?: { name: string; employeeCode: string } | null;
  }>;
  summary: {
    byType: Record<string, number>;
    totalExtraMinutes: number;
    totalExtraCost: number;
  };
};

export type DesignSuccessMetricRow = {
  id: string;
  designId: string;
  periodYear: number;
  periodMonth: number;
  productionQty?: number | null;
  salesQty?: number | null;
  salesValue?: string | number | null;
  marginPercent?: string | number | null;
  design?: {
    id: string;
    ideaRef: string;
    designNumber?: string | null;
    collectionName: string;
    productType?: { name: string } | null;
  } | null;
};

export type SampleStatusReport = {
  year: number;
  month: number;
  total: number;
  byDecision: Record<string, number>;
  byStage: Record<string, number>;
  designs: Array<{
    id: string;
    ideaRef: string;
    collectionName: string;
    sampleDecision: string | null;
    currentStage: string | null;
    status: string;
    productType?: { name: string } | null;
  }>;
};

export type ProductionStartReport = {
  year: number;
  month: number;
  total: number;
  byProductType: Array<{
    productTypeId: number;
    name: string;
    code: string;
    count: number;
  }>;
  designs: Array<{
    id: string;
    ideaRef: string;
    designNumber?: string | null;
    collectionName: string;
    status: string;
    productType?: { id: number; code: string; name: string } | null;
  }>;
};

export function useCorrectionAnalysisReport(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.corrections,
    queryFn: () => apiGet<CorrectionAnalysisReport>("/api/reports/corrections"),
    enabled,
  });
}

export function useDesignSuccessReport(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.designSuccess(year, month),
    queryFn: () =>
      apiGet<DesignSuccessMetricRow[]>(
        `/api/reports/design-success?year=${year}&month=${month}`,
      ),
    enabled,
  });
}

export function useSampleStatusReport(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.sampleStatus(year, month),
    queryFn: () =>
      apiGet<SampleStatusReport>(`/api/reports/sample-status?year=${year}&month=${month}`),
    enabled,
  });
}

export function useProductionStartReport(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.productionStart(year, month),
    queryFn: () =>
      apiGet<ProductionStartReport>(
        `/api/reports/production-start?year=${year}&month=${month}`,
      ),
    enabled,
  });
}
