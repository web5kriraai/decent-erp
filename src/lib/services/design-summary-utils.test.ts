import { describe, expect, it } from "vitest";
import { aggregateCompletionTotals } from "@/lib/services/design-summary-utils";

describe("design-summary-utils", () => {
  it("aggregates active, hold, and elapsed seconds across employees", () => {
    const totals = aggregateCompletionTotals([
      { activeSeconds: 3600, holdSeconds: 600, totalElapsedSeconds: 4200 },
      { activeSeconds: 1800, holdSeconds: 300, totalElapsedSeconds: 2100 },
    ]);

    expect(totals.peopleCount).toBe(2);
    expect(totals.totalActiveSeconds).toBe(5400);
    expect(totals.totalHoldSeconds).toBe(900);
    expect(totals.totalElapsedSeconds).toBe(6300);
  });
});
