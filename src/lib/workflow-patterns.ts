/** Product types that receive a seeded standard automatic workflow pattern. */
export const STANDARD_WORKFLOW_PRODUCT_CODES = [
  "SAREE",
  "SUIT",
  "KURTI",
  "LEHENGA",
] as const;

export type StandardWorkflowProductCode =
  (typeof STANDARD_WORKFLOW_PRODUCT_CODES)[number];

export function standardWorkflowPatternName(productTypeName: string): string {
  return `Standard ${productTypeName} Development (Full)`;
}

export type PatternProductScope = {
  id: number;
  productTypeId?: number | null;
  name?: string;
};

/**
 * Patterns shown on Create Design for a selected product type.
 * Unscoped patterns (null productTypeId) apply to every product type.
 */
export function filterWorkflowPatternsForProductType<T extends PatternProductScope>(
  patterns: T[],
  productTypeId: number | "",
): T[] {
  if (!productTypeId) return patterns;
  return patterns.filter(
    (pattern) =>
      pattern.productTypeId == null || pattern.productTypeId === productTypeId,
  );
}
