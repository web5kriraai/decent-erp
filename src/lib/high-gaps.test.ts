import { describe, expect, it } from "vitest";

describe("high gaps H1–H8 smoke", () => {
  it("exports sample outcome helpers", async () => {
    const mod = await import("@/lib/services/sample-outcome-utils");
    expect(mod.normalizeSampleOutcome("APPROVE")).toBe("PASS");
    expect(mod.sampleDecisionForOutcome("HOLD")).toBe("HOLD");
  });

  it("exports concept target service", async () => {
    const mod = await import("@/lib/services/concept-target-service");
    expect(typeof mod.listConceptTargets).toBe("function");
    expect(typeof mod.getConceptTargetAttainment).toBe("function");
  });

  it("includes SAMPLE_CUTTING / SAMPLE_STITCHING skill map", async () => {
    const { STAGE_TO_SKILL_CODE } = await import("@/lib/services/assignment-service");
    expect(STAGE_TO_SKILL_CODE.SAMPLE_CUTTING).toBe("MACHINE_SAMPLE");
    expect(STAGE_TO_SKILL_CODE.SAMPLE_STITCHING).toBe("MACHINE_SAMPLE");
  });

  it("costing summary includes MRP fields in typing contract", async () => {
    const mod = await import("@/lib/services/costing-end-utils");
    expect(mod.COST_CATEGORIES).toContain("FABRIC");
    expect(mod.COST_CATEGORIES).toContain("STITCHING");
  });
});
