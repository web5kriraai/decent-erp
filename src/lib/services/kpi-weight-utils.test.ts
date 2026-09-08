import { describe, expect, it } from "vitest";
import { roleKpiWeightsSumOk } from "@/lib/services/kpi-weight-utils";

describe("roleKpiWeightsSumOk", () => {
  it("accepts weights that sum to 100", () => {
    expect(roleKpiWeightsSumOk([40, 30, 30])).toEqual({ ok: true, sum: 100 });
  });

  it("rejects weights that do not sum to 100", () => {
    const result = roleKpiWeightsSumOk([50, 40]);
    expect(result.ok).toBe(false);
    expect(result.sum).toBe(90);
  });

  it("allows tiny floating tolerance", () => {
    expect(roleKpiWeightsSumOk([33.33, 33.33, 33.34]).ok).toBe(true);
  });
});
