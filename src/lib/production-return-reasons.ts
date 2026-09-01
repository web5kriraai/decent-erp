export const PRODUCTION_RETURN_REASON_CODES = [
  "MISSING_PRODUCTION_INSTRUCTION",
  "MISSING_FILE",
  "COSTING_ISSUE",
  "TECHNICAL_FEASIBILITY",
  "MATERIAL_CONCERN",
  "QUALITY_CONCERN",
  "OTHER",
] as const;

export type ProductionReturnReasonCode = (typeof PRODUCTION_RETURN_REASON_CODES)[number];

export type ProductionReturnReason = {
  code: ProductionReturnReasonCode;
  label: string;
  suggestedRouteCode?: string;
};

export const PRODUCTION_RETURN_REASONS: ProductionReturnReason[] = [
  {
    code: "MISSING_PRODUCTION_INSTRUCTION",
    label: "Missing production instruction",
    suggestedRouteCode: "PROD_HANDOFF",
  },
  {
    code: "MISSING_FILE",
    label: "Missing required file",
    suggestedRouteCode: "SKETCH",
  },
  {
    code: "COSTING_ISSUE",
    label: "Costing issue",
    suggestedRouteCode: "FINAL_APPROVAL",
  },
  {
    code: "TECHNICAL_FEASIBILITY",
    label: "Technical feasibility issue",
    suggestedRouteCode: "PUNCH",
  },
  {
    code: "MATERIAL_CONCERN",
    label: "Material concern",
    suggestedRouteCode: "MAT_REQ",
  },
  {
    code: "QUALITY_CONCERN",
    label: "Quality concern",
    suggestedRouteCode: "SAMPLE_CHECK",
  },
  { code: "OTHER", label: "Other clarification needed" },
];

export function labelForProductionReturnReason(code: string): string {
  return PRODUCTION_RETURN_REASONS.find((r) => r.code === code)?.label ?? code;
}

export function suggestedRouteCodeForReason(code: string): string | undefined {
  return PRODUCTION_RETURN_REASONS.find((r) => r.code === code)?.suggestedRouteCode;
}
