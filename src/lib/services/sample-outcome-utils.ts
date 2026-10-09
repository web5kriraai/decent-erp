/** Commercial + quality sample outcomes for SAMPLE_CHECK (R&D H1). */

export const SAMPLE_OUTCOMES = ["PASS", "HOLD", "REJECT", "RESAMPLE", "APPROVE"] as const;
export type SampleOutcome = (typeof SAMPLE_OUTCOMES)[number];

/** Canonical commercial decision (APPROVE is legacy alias for PASS). */
export type CanonicalSampleOutcome = "PASS" | "HOLD" | "REJECT" | "RESAMPLE";

export function normalizeSampleOutcome(outcome: string): CanonicalSampleOutcome {
  if (outcome === "APPROVE") return "PASS";
  if (outcome === "PASS" || outcome === "HOLD" || outcome === "REJECT" || outcome === "RESAMPLE") {
    return outcome;
  }
  throw new Error(`Invalid sample outcome: ${outcome}`);
}

export function isPassSampleOutcome(outcome: string | null | undefined): boolean {
  return outcome === "PASS" || outcome === "APPROVE";
}

export function isRejectSampleOutcome(outcome: string | null | undefined): boolean {
  return outcome === "REJECT";
}

export function isHoldSampleOutcome(outcome: string | null | undefined): boolean {
  return outcome === "HOLD";
}

export function isResampleSampleOutcome(outcome: string | null | undefined): boolean {
  return outcome === "RESAMPLE";
}

/** Where a sample-check reject sends the work. */
export const SAMPLE_CORRECTION_ROUTES = ["SKETCH", "PUNCH", "MACHINE_SAMPLE"] as const;
export type SampleCorrectionRoute = (typeof SAMPLE_CORRECTION_ROUTES)[number];

export function isSampleCorrectionRoute(
  value: string | null | undefined,
): value is SampleCorrectionRoute {
  return value === "SKETCH" || value === "PUNCH" || value === "MACHINE_SAMPLE";
}

/**
 * A machine-sample problem returns to the checker as soon as that sample is
 * redone. Design and punching problems walk the stages in between first.
 */
export function sampleCorrectionReturnsToChecker(routeCode: string): boolean {
  return routeCode === "MACHINE_SAMPLE";
}

/** Map commercial outcome to DesignConcept.sampleDecision (null for RESAMPLE loop). */
export function sampleDecisionForOutcome(
  outcome: CanonicalSampleOutcome,
): "PASS" | "HOLD" | "REJECT" | null {
  if (outcome === "RESAMPLE") return null;
  return outcome;
}
