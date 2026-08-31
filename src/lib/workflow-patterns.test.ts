import { describe, expect, it } from "vitest";
import {
  STANDARD_WORKFLOW_PRODUCT_CODES,
  filterWorkflowPatternsForProductType,
  standardWorkflowPatternName,
} from "@/lib/workflow-patterns";

describe("workflow pattern catalog", () => {
  it("seeds a standard pattern for every product type (create-design dropdown)", () => {
    expect([...STANDARD_WORKFLOW_PRODUCT_CODES].sort()).toEqual(
      ["KURTI", "LEHENGA", "SAREE", "SUIT"].sort(),
    );
  });

  it("names patterns by product type for admin readability", () => {
    expect(standardWorkflowPatternName("Saree")).toBe(
      "Standard Saree Development (Full)",
    );
    expect(standardWorkflowPatternName("Suit")).toBe(
      "Standard Suit Development (Full)",
    );
  });
});

describe("filterWorkflowPatternsForProductType", () => {
  const patterns = [
    { id: 1, productTypeId: 5, name: "Saree Full" },
    { id: 2, productTypeId: 6, name: "Suit Full" },
    { id: 3, productTypeId: null, name: "Generic" },
  ];

  it("returns all patterns when product type is unset", () => {
    expect(filterWorkflowPatternsForProductType(patterns, "")).toHaveLength(3);
  });

  it("includes product-scoped and global patterns for the selected type", () => {
    const suit = filterWorkflowPatternsForProductType(patterns, 6);
    expect(suit.map((p) => p.id).sort()).toEqual([2, 3]);
  });

  it("excludes patterns scoped to a different product type", () => {
    const suit = filterWorkflowPatternsForProductType(patterns, 6);
    expect(suit.some((p) => p.id === 1)).toBe(false);
  });
});
