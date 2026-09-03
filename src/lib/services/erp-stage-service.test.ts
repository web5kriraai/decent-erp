import { describe, expect, it } from "vitest";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";
import { ERP_STAGE_LABELS, nextModuleAfter } from "@/lib/services/erp-stage-constants";

describe("erp-stage chain constants", () => {
  it("covers all nine modules with labels", () => {
    expect(ERP_HANDOFF_MODULES).toHaveLength(9);
    for (const module of ERP_HANDOFF_MODULES) {
      expect(ERP_STAGE_LABELS[module]).toBeTruthy();
    }
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
