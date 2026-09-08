import { describe, expect, it } from "vitest";
import {
  formatConceptTargetTrend,
  formatConceptTargetValue,
  formatSamplePassTargetTrend,
  formatSamplePassTargetValue,
  type ConceptAttainmentDisplay,
} from "@/lib/concept-target-display";

function base(overrides: Partial<ConceptAttainmentDisplay> = {}): ConceptAttainmentDisplay {
  return {
    targetCount: 0,
    createdCount: 6,
    madeCount: 0,
    passCount: 0,
    holdCount: 0,
    rejectCount: 0,
    percent: null,
    passPercent: null,
    periodYear: 2026,
    periodMonth: 9,
    hasTarget: false,
    ...overrides,
  };
}

describe("concept-target-display", () => {
  it("avoids fake n/- and 0% when no target is set", () => {
    const a = base();
    expect(formatConceptTargetValue(a)).toBe("6");
    expect(formatConceptTargetTrend(a)).toBe("6 created · no target · 9/2026");
    expect(formatSamplePassTargetValue(a)).toBe("—");
    expect(formatSamplePassTargetTrend(a)).toContain("no target");
  });

  it("formats ratio and percent when target exists", () => {
    const a = base({
      hasTarget: true,
      targetCount: 10,
      createdCount: 6,
      passCount: 2,
      madeCount: 3,
      holdCount: 1,
      rejectCount: 0,
      percent: 60,
      passPercent: 20,
    });
    expect(formatConceptTargetValue(a)).toBe("6/10");
    expect(formatConceptTargetTrend(a)).toBe("60% created · 9/2026");
    expect(formatSamplePassTargetValue(a)).toBe("2/10");
    expect(formatSamplePassTargetTrend(a)).toBe(
      "Made 3 · Hold 1 · Reject 0 · 20% pass",
    );
  });
});
