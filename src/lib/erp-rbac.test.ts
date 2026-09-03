import { describe, expect, it } from "vitest";
import {
  assertErpStageActionAllowed,
  canCompleteErpStage,
  canOperateErpModule,
  canStartErpStage,
  canViewErpChain,
  fieldsForErpModule,
  permissionRequiredForErpModule,
  validateCompleteErpStageInput,
} from "@/lib/erp-rbac";
import { PERMISSIONS } from "@/lib/permissions";

describe("erp-rbac", () => {
  it("maps modules to SoD permissions and denies unknown modules", () => {
    expect(permissionRequiredForErpModule("CUTTING")).toBe(PERMISSIONS.ERP_FLOOR_OPERATE);
    expect(permissionRequiredForErpModule("SALES")).toBe(PERMISSIONS.ERP_SALES_OPERATE);
    expect(permissionRequiredForErpModule("ACCOUNTS")).toBe(PERMISSIONS.ERP_ACCOUNTS_OPERATE);
    expect(permissionRequiredForErpModule("NOT_A_MODULE")).toBeNull();
    expect(canOperateErpModule([PERMISSIONS.ERP_FLOOR_OPERATE], "NOT_A_MODULE")).toBe(false);
  });

  it("enforces operate checks", () => {
    const floor = [PERMISSIONS.ERP_FLOOR_OPERATE];
    expect(canOperateErpModule(floor, "GREY_MATERIAL")).toBe(true);
    expect(canOperateErpModule(floor, "SALES")).toBe(false);
    expect(canOperateErpModule([PERMISSIONS.ERP_ACCOUNTS_OPERATE], "ACCOUNTS")).toBe(true);
  });

  it("allows chain view only with ERP operate permissions", () => {
    expect(canViewErpChain([])).toBe(false);
    expect(canViewErpChain([PERMISSIONS.PRODUCTION_RELEASE])).toBe(false);
    expect(canViewErpChain([PERMISSIONS.ERP_SALES_OPERATE])).toBe(true);
  });

  it("gates start/complete by status and permission", () => {
    const floor = [PERMISSIONS.ERP_FLOOR_OPERATE];
    expect(canStartErpStage(floor, "CUTTING", "READY")).toBe(true);
    expect(canStartErpStage(floor, "CUTTING", "IN_PROGRESS")).toBe(false);
    expect(canStartErpStage(floor, "CUTTING", "PENDING")).toBe(false);
    expect(canCompleteErpStage(floor, "CUTTING", "READY")).toBe(false);
    expect(canCompleteErpStage(floor, "CUTTING", "IN_PROGRESS")).toBe(true);
    expect(canCompleteErpStage([PERMISSIONS.ERP_SALES_OPERATE], "CUTTING", "IN_PROGRESS")).toBe(
      false,
    );
  });

  it("assertErpStageActionAllowed matches UI rules", () => {
    const floor = [PERMISSIONS.ERP_FLOOR_OPERATE];
    expect(assertErpStageActionAllowed(floor, "CUTTING", "READY", "complete").ok).toBe(false);
    expect(assertErpStageActionAllowed(floor, "CUTTING", "READY", "start").ok).toBe(true);
    expect(assertErpStageActionAllowed(floor, "CUTTING", "IN_PROGRESS", "complete").ok).toBe(
      true,
    );
    expect(assertErpStageActionAllowed(floor, "SALES", "IN_PROGRESS", "complete").ok).toBe(
      false,
    );
  });

  it("validates complete payloads", () => {
    expect(validateCompleteErpStageInput("CUTTING", { qty: 0 })).toMatch(/at least 1/);
    expect(validateCompleteErpStageInput("CUTTING", { qty: 10 })).toBeNull();
    expect(validateCompleteErpStageInput("SALES_RETURN", { qty: 0 })).toBeNull();
    expect(validateCompleteErpStageInput("ACCOUNTS", {})).toMatch(/marginPercent/);
    expect(validateCompleteErpStageInput("ACCOUNTS", { marginPercent: 18 })).toBeNull();
    expect(fieldsForErpModule("ACCOUNTS").qty).toBe(false);
    expect(fieldsForErpModule("SALES").invoiceRef).toBe(true);
  });
});
