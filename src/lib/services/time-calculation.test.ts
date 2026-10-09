import { describe, expect, it } from "vitest";
import { formatWorkingTotals } from "@/lib/services/time-calculation";

describe("formatWorkingTotals", () => {
  it("shows only minutes until a full hour", () => {
    expect(formatWorkingTotals(0)).toBe("0 min");
    expect(formatWorkingTotals(55 * 60)).toBe("55 min");
    expect(formatWorkingTotals(25 * 60)).toBe("25 min");
  });

  it("steps up to the next unit when that unit is full", () => {
    expect(formatWorkingTotals(60 * 60)).toBe("1 hr");
    expect(formatWorkingTotals(90 * 60)).toBe("1 hr 30 min");
    expect(formatWorkingTotals(8 * 60 * 60)).toBe("1 day");
    expect(formatWorkingTotals(9 * 60 * 60)).toBe("1 day 1 hr");
    expect(formatWorkingTotals(6 * 8 * 60 * 60)).toBe("1 wk");
    expect(formatWorkingTotals(4 * 6 * 8 * 60 * 60)).toBe("1 mo");
    expect(formatWorkingTotals(4 * 6 * 8 * 60 * 60 + 2 * 8 * 60 * 60)).toBe("1 mo 2 day");
  });
});
