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

/** Human label for ERP module codes in tables. */
export function formatErpModuleLabel(module: string): string {
  return module
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Compact ERP reference for tables. Full value stays on title / copy.
 * LOCAL-ACCOUNTS-DN-2UC-AEXT-1790… → "DN-2UC-AEXT · …2575"
 */
export function formatErpReferenceDisplay(ref: string | null | undefined): {
  primary: string;
  secondary?: string;
  full: string;
  simulated: boolean;
} {
  if (!ref?.trim()) {
    return { primary: "-", full: "-", simulated: false };
  }
  const full = ref.trim();
  const simulated = isSimulatedErpReference(full);
  if (!simulated) {
    return { primary: full, full, simulated: false };
  }
  // LOCAL-{MODULE}-{designNumber}-{timestamp}
  const withoutLocal = full.replace(/^LOCAL-/, "");
  const firstDash = withoutLocal.indexOf("-");
  const module = firstDash >= 0 ? withoutLocal.slice(0, firstDash) : withoutLocal;
  const rest = firstDash >= 0 ? withoutLocal.slice(firstDash + 1) : "";
  const lastDash = rest.lastIndexOf("-");
  const designNo = lastDash > 0 ? rest.slice(0, lastDash) : rest;
  const stamp = lastDash > 0 ? rest.slice(lastDash + 1) : "";
  const shortStamp = stamp.length > 4 ? `…${stamp.slice(-4)}` : stamp;
  return {
    primary: designNo || module,
    secondary: shortStamp || undefined,
    full,
    simulated: true,
  };
}

/** Go-live checklist when ERP_API_BASE_URL is unset (simulated). */
export function erpGoLiveChecklistItems(): string[] {
  return [
    "Configure ERP_API_BASE_URL for live partner posts",
    "Set ERP_API_KEY (Bearer) when the partner requires auth",
    "Optional: ERP_HTTP_TIMEOUT_MS (default 15000) and ERP_HTTP_MAX_ATTEMPTS (default 3)",
    "Sync production handoffs after release",
    "In-app ERP stages at /production/erp auto-update design-success on complete",
    "Partner GET /sales/designs/{dn}/success-metrics?year=&month= for Sync from ERP",
    "Manual design-success metric entry remains available while simulated",
  ];
}
