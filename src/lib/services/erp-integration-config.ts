import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";

/** Primary ERP modules synced immediately after production release. */
export const PRIMARY_ERP_MODULES = ["GREY_MATERIAL", "CUTTING", "SALES"] as const;

/** Downstream modules synced sequentially after primary modules succeed. */
export const DOWNSTREAM_ERP_MODULES = [
  "EMBROIDERY",
  "GARMENTING",
  "FINISHING",
  "READY_STOCK",
  "ACCOUNTS",
] as const;

export const ERP_MODULE_SYNC_ORDER = [...ERP_HANDOFF_MODULES] as const;

export type ErpIntegrationMode = "simulated" | "live";

export function getErpIntegrationMode(): ErpIntegrationMode {
  return process.env.ERP_API_BASE_URL?.trim() ? "live" : "simulated";
}

export function isSimulatedErpReference(ref: string | null | undefined): boolean {
  return !!ref && ref.startsWith("LOCAL-");
}
