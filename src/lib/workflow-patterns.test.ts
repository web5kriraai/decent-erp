import { describe, expect, it } from "vitest";
import {
  STANDARD_WORKFLOW_PRODUCT_CODES,
  canonicalEightStepPatternName,
  filterWorkflowPatternsForProductType,
  isCanonicalEightStepPatternName,
  standardWorkflowPatternName,
} from "@/lib/workflow-patterns";

describe("workflow pattern catalog", () => {
  it("seeds a standard pattern for every product type (create-design dropdown)", () => {
    expect([...STANDARD_WORKFLOW_PRODUCT_CODES].sort()).toEqual(
      ["KURTI", "LEHENGA", "SAREE", "SUIT"].sort(),
    );
  });

  it("names full and 8-step patterns by product type", () => {
    expect(standardWorkflowPatternName("Saree")).toBe(
      "Standard Saree Development (Full)",
    );
    expect(canonicalEightStepPatternName("Saree")).toBe(
      "Spec 8-Step Saree (Concept→Final)",
    );
    expect(isCanonicalEightStepPatternName("Spec 8-Step Saree (Concept→Final)")).toBe(true);
    expect(isCanonicalEightStepPatternName("Standard Saree Development (Full)")).toBe(false);
  });
});

describe("filterWorkflowPatternsForProductType", () => {
  const patterns = [
    { id: 1, productTypeId: 5, name: "Standard Saree Development (Full)" },
    { id: 2, productTypeId: 6, name: "Standard Suit Development (Full)" },
    { id: 3, productTypeId: null, name: "Generic" },
    { id: 4, productTypeId: 6, name: "Spec 8-Step Suit (Concept→Final)" },
  ];

  it("returns all patterns when product type is unset", () => {
    expect(filterWorkflowPatternsForProductType(patterns, "")).toHaveLength(4);
  });

  it("includes product-scoped and global patterns for the selected type", () => {
    const suit = filterWorkflowPatternsForProductType(patterns, 6);
    expect(suit.map((p) => p.id).sort()).toEqual([2, 3, 4]);
  });

  it("sorts Spec 8-Step patterns first for demo defaults", () => {
    const suit = filterWorkflowPatternsForProductType(patterns, 6);
    expect(suit[0].id).toBe(4);
  });

  it("excludes patterns scoped to a different product type", () => {
    const suit = filterWorkflowPatternsForProductType(patterns, 6);
    expect(suit.some((p) => p.id === 1)).toBe(false);
  });
});
