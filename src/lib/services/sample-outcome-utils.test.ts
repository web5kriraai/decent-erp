import { describe, expect, it } from "vitest";
import {
  isHoldSampleOutcome,
  isPassSampleOutcome,
  isSampleCorrectionRoute,
  normalizeSampleOutcome,
  sampleCorrectionReturnsToChecker,
  sampleDecisionForOutcome,
} from "@/lib/services/sample-outcome-utils";

describe("sample outcome utils (H1)", () => {
  it("maps APPROVE to PASS", () => {
    expect(normalizeSampleOutcome("APPROVE")).toBe("PASS");
    expect(isPassSampleOutcome("APPROVE")).toBe(true);
    expect(isPassSampleOutcome("PASS")).toBe(true);
  });

  it("maps commercial decisions; RESAMPLE has no sampleDecision", () => {
    expect(sampleDecisionForOutcome("PASS")).toBe("PASS");
    expect(sampleDecisionForOutcome("HOLD")).toBe("HOLD");
    expect(sampleDecisionForOutcome("REJECT")).toBe("REJECT");
    expect(sampleDecisionForOutcome("RESAMPLE")).toBeNull();
    expect(isHoldSampleOutcome("HOLD")).toBe(true);
  });

  it("sends only a machine-sample problem straight back to the checker", () => {
    expect(isSampleCorrectionRoute("SKETCH")).toBe(true);
    expect(isSampleCorrectionRoute("COSTING")).toBe(false);
    expect(sampleCorrectionReturnsToChecker("MACHINE_SAMPLE")).toBe(true);
    expect(sampleCorrectionReturnsToChecker("SKETCH")).toBe(false);
    expect(sampleCorrectionReturnsToChecker("PUNCH")).toBe(false);
  });
});
