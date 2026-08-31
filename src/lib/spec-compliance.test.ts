import { describe, expect, it } from "vitest";
import { computeActiveSeconds, computeHoldSeconds, computeTimeSummary } from "@/lib/services/time-calculation";
import { MISTAKE_CORRECTION_TYPES, SPEC_KPI_METRICS } from "@/lib/kpi-metrics";

describe("time calculation", () => {
  const base = new Date("2026-08-24T09:00:00Z");

  it("computes active seconds excluding hold intervals (TC-05/TC-06)", () => {
    const events = [
      { eventType: "START", eventTimeUtc: base },
      { eventType: "HOLD", eventTimeUtc: new Date("2026-08-24T10:00:00Z"), holdReason: { code: "LUNCH" } },
      { eventType: "RESUME", eventTimeUtc: new Date("2026-08-24T10:30:00Z") },
      { eventType: "END", eventTimeUtc: new Date("2026-08-24T11:00:00Z") },
    ];
    expect(computeActiveSeconds(events)).toBe(5400); // 1h + 30m active
    expect(computeHoldSeconds(events)).toBe(1800); // 30m hold
    const summary = computeTimeSummary(events);
    expect(summary.activeSeconds + summary.holdSeconds).toBeLessThanOrEqual(summary.totalElapsedSeconds);
  });
});

describe("KPI metrics spec", () => {
  it("defines nine metrics totaling 100% weight (TC-15)", () => {
    const total = SPEC_KPI_METRICS.reduce((sum, m) => sum + m.weight, 0);
    expect(SPEC_KPI_METRICS).toHaveLength(9);
    expect(total).toBe(100);
  });

  it("treats improvement separately from mistake types (TC-10)", () => {
    expect(MISTAKE_CORRECTION_TYPES).toContain("MISTAKE");
    expect(MISTAKE_CORRECTION_TYPES).not.toContain("IMPROVEMENT");
  });
});

describe("permissions", () => {
  it("admin has all permissions", async () => {
    const { hasPermission, PERMISSIONS } = await import("@/lib/permissions");
    const adminPerms = Object.values(PERMISSIONS);
    expect(hasPermission(adminPerms, PERMISSIONS.MASTER_ADMIN)).toBe(true);
    expect(hasPermission(adminPerms, PERMISSIONS.KPI_ADMIN)).toBe(true);
  });
});
