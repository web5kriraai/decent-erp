import { describe, expect, it } from "vitest";
import { ERP_FLOOR_MODULES } from "@/lib/erp-rbac";
import { computeFloorErpProgress } from "@/lib/services/erp-floor-progress";

describe("computeFloorErpProgress (PROD_RELEASE gate)", () => {
  it("fails when no stages seeded", () => {
    const progress = computeFloorErpProgress([]);
    expect(progress.ok).toBe(false);
    expect(progress.completed).toBe(0);
    expect(progress.total).toBe(6);
    expect(progress.missing[0]).toMatch(/seed/i);
  });

  it("lists incomplete Floor modules", () => {
    const stages = ERP_FLOOR_MODULES.map((erpModule, i) => ({
      erpModule,
      status: i < 2 ? "COMPLETED" : i === 2 ? "IN_PROGRESS" : "PENDING",
    }));
    const progress = computeFloorErpProgress(stages);
    expect(progress.ok).toBe(false);
    expect(progress.completed).toBe(2);
    expect(progress.missing).toHaveLength(4);
    expect(progress.missing.some((m) => /Embroidery/i.test(m))).toBe(true);
    expect(progress.missing.some((m) => /in progress/i.test(m))).toBe(true);
  });

  it("passes only when every Floor module is COMPLETED", () => {
    const incomplete = computeFloorErpProgress(
      ERP_FLOOR_MODULES.map((erpModule, i) => ({
        erpModule,
        status: i < 5 ? "COMPLETED" : "READY",
      })),
    );
    expect(incomplete.ok).toBe(false);
    expect(incomplete.completed).toBe(5);

    const complete = computeFloorErpProgress(
      ERP_FLOOR_MODULES.map((erpModule) => ({
        erpModule,
        status: "COMPLETED",
      })),
    );
    expect(complete.ok).toBe(true);
    expect(complete.completed).toBe(6);
    expect(complete.missing).toEqual([]);
  });

  it("ignores Sales/Accounts for the Floor gate", () => {
    const stages = [
      ...ERP_FLOOR_MODULES.map((erpModule) => ({
        erpModule,
        status: "COMPLETED",
      })),
      { erpModule: "SALES", status: "PENDING" },
      { erpModule: "ACCOUNTS", status: "PENDING" },
    ];
    const progress = computeFloorErpProgress(stages);
    expect(progress.ok).toBe(true);
  });
});
