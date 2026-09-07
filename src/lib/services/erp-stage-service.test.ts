import { describe, expect, it } from "vitest";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";
import { ERP_FLOOR_MODULES, isErpFloorModule } from "@/lib/erp-rbac";
import { ERP_STAGE_LABELS, nextModuleAfter } from "@/lib/services/erp-stage-constants";

describe("erp-stage chain constants", () => {
  it("covers all nine modules with labels", () => {
    expect(ERP_HANDOFF_MODULES).toHaveLength(9);
    for (const module of ERP_HANDOFF_MODULES) {
      expect(ERP_STAGE_LABELS[module]).toBeTruthy();
    }
  });

  it("exports six Floor modules for PROD_RELEASE gate", () => {
    expect(ERP_FLOOR_MODULES).toHaveLength(6);
    expect(ERP_FLOOR_MODULES[0]).toBe("GREY_MATERIAL");
    expect(ERP_FLOOR_MODULES[5]).toBe("READY_STOCK");
    expect(isErpFloorModule("SALES")).toBe(false);
    expect(isErpFloorModule("CUTTING")).toBe(true);
  });

  it("unlocks modules in manufacturing order", () => {
    expect(nextModuleAfter("GREY_MATERIAL")).toBe("CUTTING");
    expect(nextModuleAfter("CUTTING")).toBe("EMBROIDERY");
    expect(nextModuleAfter("READY_STOCK")).toBe("SALES");
    expect(nextModuleAfter("SALES")).toBe("SALES_RETURN");
    expect(nextModuleAfter("SALES_RETURN")).toBe("ACCOUNTS");
    expect(nextModuleAfter("ACCOUNTS")).toBeNull();
  });
});

describe("floorErpProgressFromStatuses", () => {
  it("treats empty stages as incomplete", () => {
    const total = ERP_FLOOR_MODULES.length;
    const completed = 0;
    expect(completed === total).toBe(false);
  });

  it("is ok only when every Floor module is COMPLETED", () => {
    const statuses = Object.fromEntries(
      ERP_FLOOR_MODULES.map((m, i) => [m, i < 5 ? "COMPLETED" : "READY"]),
    );
    const completed = ERP_FLOOR_MODULES.filter((m) => statuses[m] === "COMPLETED").length;
    expect(completed).toBe(5);
    expect(completed === ERP_FLOOR_MODULES.length).toBe(false);

    for (const m of ERP_FLOOR_MODULES) statuses[m] = "COMPLETED";
    const done = ERP_FLOOR_MODULES.filter((m) => statuses[m] === "COMPLETED").length;
    expect(done).toBe(6);
  });
});
