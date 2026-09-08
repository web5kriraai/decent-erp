import { describe, expect, it } from "vitest";
import {
  effectiveDayOffset,
  hoursToExpectedMinutes,
  plannedDueAt,
  resolveManualDueAt,
} from "@/lib/services/task-date-mode";

describe("effectiveDayOffset", () => {
  it("SEQUENTIAL uses pattern dayOffset", () => {
    expect(effectiveDayOffset("SEQUENTIAL", 5, 2)).toBe(5);
  });

  it("SAME_DAY forces zero", () => {
    expect(effectiveDayOffset("SAME_DAY", 5, 2)).toBe(0);
  });

  it("SEQUENTIAL_BY_INDEX uses index", () => {
    expect(effectiveDayOffset("SEQUENTIAL_BY_INDEX", 5, 2)).toBe(2);
  });
});

describe("resolveManualDueAt", () => {
  const base = new Date("2026-08-01T10:00:00.000Z");

  it("parses date-only as end of day", () => {
    const due = resolveManualDueAt("2026-08-05", base, 60);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7);
    expect(due.getDate()).toBe(5);
  });

  it("falls back to expected minutes from base", () => {
    const due = resolveManualDueAt(undefined, base, 120);
    expect(due.getTime()).toBe(plannedDueAt(base, 120).getTime());
  });
});

describe("hoursToExpectedMinutes", () => {
  it("converts fractional hours", () => {
    expect(hoursToExpectedMinutes(2.5)).toBe(150);
  });
});
