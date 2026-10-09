import { describe, expect, it } from "vitest";
import { computeActiveSeconds } from "@/lib/services/time-calculation";

describe("hold time exclusion (§16.8)", () => {
  it("excludes hold intervals from active seconds", () => {
    const start = new Date("2026-01-01T09:00:00.000Z");
    const hold = new Date("2026-01-01T10:00:00.000Z");
    const resume = new Date("2026-01-01T10:30:00.000Z");
    const end = new Date("2026-01-01T11:00:00.000Z");

    const seconds = computeActiveSeconds(
      [
        { eventType: "START", eventTimeUtc: start },
        { eventType: "HOLD", eventTimeUtc: hold },
        { eventType: "RESUME", eventTimeUtc: resume },
        { eventType: "END", eventTimeUtc: end },
      ],
      end,
    );

    // 09:00-10:00 (3600) + 10:30-11:00 (1800) = 5400; hold 30m excluded
    expect(seconds).toBe(5400);
  });
});
