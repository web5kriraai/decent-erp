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
