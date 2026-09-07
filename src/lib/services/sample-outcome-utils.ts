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

/** Map commercial outcome to DesignConcept.sampleDecision (null for RESAMPLE loop). */
export function sampleDecisionForOutcome(
  outcome: CanonicalSampleOutcome,
): "PASS" | "HOLD" | "REJECT" | null {
  if (outcome === "RESAMPLE") return null;
  return outcome;
}
