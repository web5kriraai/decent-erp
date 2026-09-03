import { hasPermission, PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";

const FLOOR_MODULES = new Set([
  "GREY_MATERIAL",
  "CUTTING",
  "EMBROIDERY",
  "GARMENTING",
  "FINISHING",
  "READY_STOCK",
]);

const SALES_MODULES = new Set(["SALES", "SALES_RETURN"]);

/** Permissions that can open /production/erp and list chains (SoD operate grants). */
export const ERP_CHAIN_VIEW_PERMISSIONS: PermissionCode[] = [
  PERMISSIONS.ERP_FLOOR_OPERATE,
  PERMISSIONS.ERP_SALES_OPERATE,
  PERMISSIONS.ERP_ACCOUNTS_OPERATE,
];

export type ErpStageAction = "start" | "complete";

export function canViewErpChain(userPermissions: string[]): boolean {
  return hasPermission(userPermissions, ERP_CHAIN_VIEW_PERMISSIONS);
}

export function isKnownErpModule(module: string): boolean {
  return (ERP_HANDOFF_MODULES as readonly string[]).includes(module);
}

/** Returns null when module is unknown (deny). */
export function permissionRequiredForErpModule(module: string): PermissionCode | null {
  if (!isKnownErpModule(module)) return null;
  if (FLOOR_MODULES.has(module)) return PERMISSIONS.ERP_FLOOR_OPERATE;
  if (SALES_MODULES.has(module)) return PERMISSIONS.ERP_SALES_OPERATE;
  if (module === "ACCOUNTS") return PERMISSIONS.ERP_ACCOUNTS_OPERATE;
  return null;
}

export function canOperateErpModule(userPermissions: string[], module: string): boolean {
  const needed = permissionRequiredForErpModule(module);
  if (!needed) return false;
  return hasPermission(userPermissions, needed);
}

/** Start is only valid from READY (not PENDING / COMPLETED). */
export function canStartErpStage(
  userPermissions: string[],
  module: string,
  status: string,
): boolean {
  return status === "READY" && canOperateErpModule(userPermissions, module);
}

/** Complete is only valid from IN_PROGRESS (must Start first). */
export function canCompleteErpStage(
  userPermissions: string[],
  module: string,
  status: string,
): boolean {
  return status === "IN_PROGRESS" && canOperateErpModule(userPermissions, module);
}

export function assertErpStageActionAllowed(
  userPermissions: string[],
  module: string,
  status: string,
  action: ErpStageAction,
): { ok: true } | { ok: false; status: number; message: string; permission?: PermissionCode } {
  if (!isKnownErpModule(module)) {
    return { ok: false, status: 400, message: `Unknown ERP module: ${module}` };
  }
  const needed = permissionRequiredForErpModule(module);
  if (!needed || !canOperateErpModule(userPermissions, module)) {
    return {
      ok: false,
      status: 403,
      message: "Permission denied for this ERP stage",
      permission: needed ?? undefined,
    };
  }
  if (action === "start") {
    if (status === "IN_PROGRESS") {
      return { ok: false, status: 409, message: "Stage is already in progress" };
    }
    if (status !== "READY") {
      return {
        ok: false,
        status: 409,
        message: `Cannot start stage in status ${status}`,
      };
    }
    return { ok: true };
  }
  if (status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      message:
        status === "READY"
          ? "Start the stage before completing it"
          : `Cannot complete stage in status ${status}`,
    };
  }
  return { ok: true };
}

/** Stage-aware fields shown in the complete form (only when Complete is allowed). */
export function fieldsForErpModule(module: string): {
  qty: boolean;
  wastageQty: boolean;
  amount: boolean;
  lotRef: boolean;
  invoiceRef: boolean;
  remark: boolean;
  marginPercent: boolean;
  qtyRequired: boolean;
  /** Minimum qty when qty field applies (0 allowed for Sales Return). */
  qtyMin: number;
} {
  const base = {
    qty: true,
    wastageQty: false,
    amount: false,
    lotRef: false,
    invoiceRef: false,
    remark: true,
    marginPercent: false,
    qtyRequired: false,
    qtyMin: 1,
  };
  switch (module) {
    case "GREY_MATERIAL":
    case "CUTTING":
      return { ...base, wastageQty: true, lotRef: true, qtyRequired: true, qtyMin: 1 };
    case "EMBROIDERY":
    case "GARMENTING":
    case "FINISHING":
      return { ...base, qtyRequired: true, qtyMin: 1 };
    case "READY_STOCK":
      return { ...base, lotRef: true, qtyRequired: true, qtyMin: 1 };
    case "SALES":
      return { ...base, amount: true, invoiceRef: true, qtyRequired: true, qtyMin: 1 };
    case "SALES_RETURN":
      return { ...base, amount: true, invoiceRef: true, qtyRequired: true, qtyMin: 0 };
    case "ACCOUNTS":
      return {
        ...base,
        qty: false,
        amount: false,
        marginPercent: true,
        remark: true,
        qtyRequired: false,
        qtyMin: 0,
      };
    default:
      return base;
  }
}

export type CompleteErpStagePayload = {
  qty?: number;
  wastageQty?: number;
  amount?: number;
  lotRef?: string;
  invoiceRef?: string;
  remark?: string;
  marginPercent?: number;
};

export function validateCompleteErpStageInput(
  module: string,
  input: CompleteErpStagePayload,
): string | null {
  const fields = fieldsForErpModule(module);
  if (fields.qty && fields.qtyRequired) {
    if (input.qty == null || Number.isNaN(input.qty) || input.qty < fields.qtyMin) {
      return fields.qtyMin > 0
        ? `qty must be at least ${fields.qtyMin} for this stage`
        : "qty is required for this stage";
    }
  }
  if (fields.wastageQty && input.wastageQty != null && input.wastageQty < 0) {
    return "wastageQty cannot be negative";
  }
  if (fields.amount && input.amount != null && (Number.isNaN(input.amount) || input.amount < 0)) {
    return "amount cannot be negative";
  }
  if (fields.marginPercent) {
    if (
      input.marginPercent == null ||
      Number.isNaN(input.marginPercent) ||
      input.marginPercent < -100 ||
      input.marginPercent > 100
    ) {
      return "marginPercent is required (between -100 and 100)";
    }
  }
  return null;
}
