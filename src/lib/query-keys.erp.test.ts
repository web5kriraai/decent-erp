import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query-keys";

/** Mirrors TanStack Query partial-match: filter matches if queryKey starts with filter. */
function queryKeyMatches(queryKey: readonly unknown[], filter: readonly unknown[]) {
  if (filter.length > queryKey.length) return false;
  return filter.every((part, i) => Object.is(part, queryKey[i]));
}

describe("production ERP query keys", () => {
  it("erpStagesRoot invalidation matches list and per-design queries", () => {
    const root = queryKeys.production.erpStagesRoot;
    const list = queryKeys.production.erpStages();
    const byDesign = queryKeys.production.erpStages("design-1");

    expect(queryKeyMatches(list, root)).toBe(true);
    expect(queryKeyMatches(byDesign, root)).toBe(true);
    expect(list).not.toEqual(byDesign);
  });

  it("handoffsRoot invalidation matches list and per-design queries", () => {
    const root = queryKeys.production.handoffsRoot;
    const list = queryKeys.production.handoffs();
    const byDesign = queryKeys.production.handoffs("design-1");

    expect(queryKeyMatches(list, root)).toBe(true);
    expect(queryKeyMatches(byDesign, root)).toBe(true);
  });

  it("legacy trailing-undefined key would not match per-design (regression)", () => {
    const brokenInvalidate = ["production", "erp-stages", undefined] as const;
    const byDesign = ["production", "erp-stages", "design", "design-1"] as const;
    expect(queryKeyMatches(byDesign, brokenInvalidate)).toBe(false);
  });
});
