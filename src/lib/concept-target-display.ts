/**
 * Display helpers for monthly concept / sample-pass target cards.
 * Avoids fake "n/-" and "0%" when no target is configured for the period.
 */

export type ConceptAttainmentDisplay = {
  targetCount: number;
  createdCount: number;
  madeCount: number;
  passCount: number;
  holdCount: number;
  rejectCount: number;
  percent: number | null;
  passPercent: number | null;
  periodYear: number;
  periodMonth: number;
  hasTarget: boolean;
};

export function formatConceptTargetValue(a: ConceptAttainmentDisplay): string {
  if (!a.hasTarget) {
    return a.createdCount > 0 ? String(a.createdCount) : "—";
  }
  return `${a.createdCount}/${a.targetCount}`;
}

export function formatConceptTargetTrend(a: ConceptAttainmentDisplay): string {
  const period = `${a.periodMonth}/${a.periodYear}`;
  if (!a.hasTarget) {
    return a.createdCount > 0
      ? `${a.createdCount} created · no target · ${period}`
      : `No target set · ${period}`;
  }
  return `${a.percent ?? 0}% created · ${period}`;
}

export function formatSamplePassTargetValue(a: ConceptAttainmentDisplay): string {
  if (!a.hasTarget) {
    return a.passCount > 0 ? String(a.passCount) : "—";
  }
  return `${a.passCount}/${a.targetCount}`;
}

export function formatSamplePassTargetTrend(a: ConceptAttainmentDisplay): string {
  const breakdown = `Made ${a.madeCount} · Hold ${a.holdCount} · Reject ${a.rejectCount}`;
  if (!a.hasTarget) {
    return `${breakdown} · no target`;
  }
  return `${breakdown} · ${a.passPercent ?? 0}% pass`;
}
