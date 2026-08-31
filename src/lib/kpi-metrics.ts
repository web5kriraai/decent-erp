/** Spec §9.1 — nine KPI metrics with official weights (percent). */
export const SPEC_KPI_METRICS = [
  { code: "ON_TIME_COMPLETION", weight: 20, label: "On-time Completion" },
  { code: "QUALITY_APPROVAL", weight: 20, label: "Quality / Approval" },
  { code: "FIRST_TIME_RIGHT", weight: 15, label: "First-time Right" },
  { code: "CORRECTION_PERFORMANCE", weight: 10, label: "Correction Performance" },
  { code: "CREATIVITY", weight: 10, label: "Creativity / Design Quality" },
  { code: "COST_CONTROL", weight: 10, label: "Cost Control" },
  { code: "TEAM_COORDINATION", weight: 5, label: "Team Coordination" },
  { code: "PRODUCTIVITY", weight: 5, label: "Productivity" },
  { code: "DOCUMENTATION", weight: 5, label: "Documentation Discipline" },
] as const;

export const KPI_CALCULATION_VERSION = 2;

export const MISTAKE_CORRECTION_TYPES = ["MISTAKE", "MACHINE_MATERIAL_ISSUE"] as const;

export const ERP_HANDOFF_MODULES = [
  "GREY_MATERIAL",
  "CUTTING",
  "EMBROIDERY",
  "GARMENTING",
  "FINISHING",
  "READY_STOCK",
  "SALES",
  "ACCOUNTS",
] as const;
