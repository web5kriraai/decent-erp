import { describe, expect, it } from "vitest";
import {
  computeCorrectionTimeBreakdown,
  formatActiveDuration,
} from "@/lib/services/correction-time-utils";

describe("computeCorrectionTimeBreakdown", () => {
  it("splits prior and rework around correction createdAt", () => {
    const createdAt = new Date("2026-09-08T12:00:00.000Z");
    const source = [
      {
        eventType: "START",
        eventTimeUtc: "2026-09-08T10:00:00.000Z",
      },
      {
        eventType: "END",
        eventTimeUtc: "2026-09-08T11:00:00.000Z",
      },
    ];
    const routed = [
      {
        eventType: "START",
        eventTimeUtc: "2026-09-08T13:00:00.000Z",
      },
      {
        eventType: "END",
        eventTimeUtc: "2026-09-08T13:30:00.000Z",
      },
    ];

    const breakdown = computeCorrectionTimeBreakdown({
      createdAtUtc: createdAt,
      employeeId: 7,
      sourceTaskEvents: source,
      routedTaskEvents: routed,
      now: new Date("2026-09-08T14:00:00.000Z"),
    });

    expect(breakdown.originalActiveSeconds).toBe(3600);
    expect(breakdown.reworkActiveSeconds).toBe(1800);
    expect(breakdown.totalActiveSeconds).toBe(5400);
    expect(breakdown.measuredExtraMinutes).toBe(30);
  });

  it("formats durations", () => {
    expect(formatActiveDuration(0)).toBe("0m");
    expect(formatActiveDuration(90)).toBe("1m");
    expect(formatActiveDuration(3660)).toBe("1h 1m");
  });
});
