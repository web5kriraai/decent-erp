import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";

export const ERP_STAGE_STATUSES = [
  "PENDING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type ErpStageStatus = (typeof ERP_STAGE_STATUSES)[number];

export const ERP_STAGE_LABELS: Record<(typeof ERP_HANDOFF_MODULES)[number], string> = {
  GREY_MATERIAL: "Grey / Material",
  CUTTING: "Cutting",
  EMBROIDERY: "Embroidery",
  GARMENTING: "Garmenting",
  FINISHING: "Finishing",
  READY_STOCK: "Ready Stock",
  SALES: "Sales",
  SALES_RETURN: "Sales Return",
  ACCOUNTS: "Accounts",
};

/** Next module in the manufacturing sync order (null after Accounts). */
export function nextModuleAfter(module: string): string | null {
  const idx = ERP_HANDOFF_MODULES.indexOf(
    module as (typeof ERP_HANDOFF_MODULES)[number],
  );
  if (idx < 0 || idx >= ERP_HANDOFF_MODULES.length - 1) return null;
  return ERP_HANDOFF_MODULES[idx + 1];
}
