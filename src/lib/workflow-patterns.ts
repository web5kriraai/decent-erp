/** Product types that receive a seeded standard automatic workflow pattern. */
export const STANDARD_WORKFLOW_PRODUCT_CODES = [
  "SAREE",
  "SUIT",
  "KURTI",
  "LEHENGA",
] as const;

export type StandardWorkflowProductCode =
  (typeof STANDARD_WORKFLOW_PRODUCT_CODES)[number];

/** Spec §6.2 — Concept → Final Approval (8 steps). Prefer for UAT/demo. */
export function canonicalEightStepPatternName(productTypeName: string): string {
  return `Spec 8-Step ${productTypeName} (Concept→Final)`;
}

/** Full shop-floor chain including materials + production ladder. */
export function standardWorkflowPatternName(productTypeName: string): string {
  return `Standard ${productTypeName} Development (Full)`;
}

export function isCanonicalEightStepPatternName(name: string): boolean {
  return name.startsWith("Spec 8-Step ");
}

export type PatternProductScope = {
  id: number;
  productTypeId?: number | null;
  name?: string;
};

/**
 * Patterns shown on Create Design for a selected product type.
 * Unscoped patterns (null productTypeId) apply to every product type.
 * Spec 8-step patterns sort first so demos default to the shorter path.
 */
export function filterWorkflowPatternsForProductType<T extends PatternProductScope>(
  patterns: T[],
  productTypeId: number | "",
): T[] {
  const filtered =
    !productTypeId
      ? [...patterns]
      : patterns.filter(
          (pattern) =>
            pattern.productTypeId == null || pattern.productTypeId === productTypeId,
        );

  return filtered.sort((a, b) => {
    const aCanon = a.name && isCanonicalEightStepPatternName(a.name) ? 0 : 1;
    const bCanon = b.name && isCanonicalEightStepPatternName(b.name) ? 0 : 1;
    if (aCanon !== bCanon) return aCanon - bCanon;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}
