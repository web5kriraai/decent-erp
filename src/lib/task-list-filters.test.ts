import { describe, expect, it } from "vitest";
import { countDashboardOpenTasks, isDashboardOpenTask } from "@/lib/task-list-filters";

describe("isDashboardOpenTask", () => {
  it("counts actionable assigned and rework tasks", () => {
    expect(isDashboardOpenTask({ status: "ASSIGNED" })).toBe(true);
    expect(isDashboardOpenTask({ status: "CORRECTION_REQUIRED" })).toBe(true);
    expect(isDashboardOpenTask({ status: "RUNNING" })).toBe(true);
  });

  it("excludes waiting, completed, pending, and checking tasks", () => {
    expect(
      isDashboardOpenTask({
        status: "ASSIGNED",
        isWaitingOnOthers: true,
      }),
    ).toBe(false);
    expect(
      isDashboardOpenTask({
        status: "CHECKING",
        effectiveStatus: "CHECKING",
      }),
    ).toBe(false);
    expect(isDashboardOpenTask({ status: "PENDING" })).toBe(false);
    expect(isDashboardOpenTask({ status: "COMPLETED" })).toBe(false);
  });
});

describe("countDashboardOpenTasks", () => {
  it("returns the number of open actionable tasks", () => {
    expect(
      countDashboardOpenTasks([
        { status: "RUNNING" },
        { status: "PENDING" },
        { status: "ASSIGNED", isWaitingOnOthers: true },
        { status: "ON_HOLD" },
      ]),
    ).toBe(2);
  });
});
