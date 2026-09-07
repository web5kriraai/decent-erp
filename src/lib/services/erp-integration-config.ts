import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";

/** Primary ERP modules synced immediately after production release. */
export const PRIMARY_ERP_MODULES = ["GREY_MATERIAL", "CUTTING", "SALES"] as const;

/** Downstream modules synced sequentially after primary modules succeed. */
export const DOWNSTREAM_ERP_MODULES = [
  "EMBROIDERY",
  "GARMENTING",
  "FINISHING",
  "READY_STOCK",
  "SALES_RETURN",
  "ACCOUNTS",
] as const;

export const ERP_MODULE_SYNC_ORDER = [...ERP_HANDOFF_MODULES] as const;

export type ErpIntegrationMode = "simulated" | "live";

export type HandoffDisplayStatus = "QUEUED" | "SYNCED" | "FAILED" | "LOCAL";

export function getErpIntegrationMode(): ErpIntegrationMode {
  return process.env.ERP_API_BASE_URL?.trim() ? "live" : "simulated";
}

export function isSimulatedErpReference(ref: string | null | undefined): boolean {
  return !!ref && ref.startsWith("LOCAL-");
}

/** UI-facing status: SYNCED with LOCAL-* ref shows as LOCAL. */
export function getHandoffDisplayStatus(input: {
  status: string;
  erpReference?: string | null;
}): HandoffDisplayStatus {
  if (input.status === "FAILED") return "FAILED";
  if (input.status === "QUEUED") return "QUEUED";
  if (input.status === "SYNCED" && isSimulatedErpReference(input.erpReference)) {
    return "LOCAL";
  }
  if (input.status === "SYNCED") return "SYNCED";
  return "QUEUED";
}

export function erpSyncOrderMessage(mode: ErpIntegrationMode): string {
  const chain = ERP_MODULE_SYNC_ORDER.join(" → ");
  if (mode === "simulated") {
    return `ERP_API_BASE_URL is not set - all modules sync as LOCAL-* simulated references (${chain}).`;
  }
  return `Live ERP sync order: ${chain}.`;
}

/** Short badge label for Live vs Simulated/LOCAL. */
export function erpModeDisplayLabel(mode: ErpIntegrationMode): string {
  return mode === "live" ? "Live ERP" : "Simulated / LOCAL";
}

/** One-line desk hint under the mode badge. */
export function erpModeShortHint(mode: ErpIntegrationMode): string {
  return mode === "live"
    ? "Partner ERP connected"
    : "LOCAL mode - set ERP_API_BASE_URL to go live";
}

/** Go-live checklist when ERP_API_BASE_URL is unset (simulated). */
export function erpGoLiveChecklistItems(): string[] {
  return [
    "Configure ERP_API_BASE_URL for live partner posts",
    "Sync production handoffs after release",
    "Manual design-success metric entry remains available while simulated",
  ];
}
