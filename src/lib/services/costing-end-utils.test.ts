import { describe, expect, it } from "vitest";
import {
  buildCostingOutputRemark,
  costingEndHasPositiveCosts,
  mergeCostAmountsByType,
  totalFromByType,
} from "@/lib/services/costing-end-utils";

describe("costingEndHasPositiveCosts", () => {
  it("accepts existing saved costs without drafts", () => {
    expect(costingEndHasPositiveCosts(true, [])).toBe(true);
  });

  it("rejects empty existing and empty drafts", () => {
    expect(costingEndHasPositiveCosts(false, [])).toBe(false);
  });

  it("accepts draft lines with positive amounts", () => {
    expect(
      costingEndHasPositiveCosts(false, [
        { amount: 0 },
        { amount: 12.5 },
      ]),
    ).toBe(true);
  });

  it("rejects drafts with only zero amounts", () => {
    expect(costingEndHasPositiveCosts(false, [{ amount: 0 }])).toBe(false);
  });
});

describe("mergeCostAmountsByType / buildCostingOutputRemark", () => {
  it("merges existing and draft amounts by type", () => {
    const byType = mergeCostAmountsByType(
      { TIME: 100, MATERIAL: 50 },
      [
        { costType: "TIME", amount: 25 },
        { costType: "MACHINE", amount: 10, description: "laser" },
      ],
    );
    expect(byType).toEqual({ TIME: 125, MATERIAL: 50, MACHINE: 10 });
    expect(totalFromByType(byType)).toBe(185);
  });

  it("builds auto remark from totals", () => {
    const remark = buildCostingOutputRemark(
      { TIME: 100, MATERIAL: 200 },
      300,
    );
    expect(remark).toContain("TIME ₹100.00");
    expect(remark).toContain("MATERIAL ₹200.00");
    expect(remark).toContain("total ₹300.00");
  });

  it("appends optional note to auto remark", () => {
    const remark = buildCostingOutputRemark({ TIME: 10 }, 10, "Ready for final");
    expect(remark).toMatch(/Ready for final$/);
  });

  it("falls back when no positive amounts", () => {
    expect(buildCostingOutputRemark({}, 0)).toBe("Costing submitted");
  });
});
