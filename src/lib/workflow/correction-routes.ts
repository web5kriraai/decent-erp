import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

export type CorrectionRouteCandidate = {
  code: string;
  name: string;
  isCorrectionAllowed?: boolean;
  capabilities?: unknown;
  status?: string;
};

const FALLBACK_ROUTE_CODES = ["SKETCH", "PUNCH", "MACHINE_SAMPLE", "COSTING"] as const;

/**
 * Prefer design stages that allow corrections; fall back to textile defaults
 * when the design has no correction-capable stages yet.
 */
export function correctionRouteCodesFromStages(
  stages: CorrectionRouteCandidate[],
): string[] {
  const allowed = stages
    .filter((s) => {
      const behavior = resolveStageBehavior({
        code: s.code,
        isCorrectionAllowed: s.isCorrectionAllowed,
        capabilities: s.capabilities,
      });
      return behavior.isCorrectionAllowed && !behavior.isApproval;
    })
    .map((s) => s.code);

  const unique = [...new Set(allowed)];
  if (unique.length > 0) return unique;
  return [...FALLBACK_ROUTE_CODES];
}

export function suggestedCorrectionRouteCode(
  sourceCode: string | null | undefined,
  routeCodes: string[],
): string {
  if (!routeCodes.length) return FALLBACK_ROUTE_CODES[1];
  if (sourceCode) {
    const behavior = resolveStageBehavior({ code: sourceCode });
    const precursor = behavior.workPrecursorCode;
    if (precursor && routeCodes.includes(precursor)) return precursor;
    if (routeCodes.includes(sourceCode)) return sourceCode;
  }
  return routeCodes[0];
}
