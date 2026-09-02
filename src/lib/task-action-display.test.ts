import { describe, expect, it } from "vitest";
import {
  formatActionCenterCompletedAt,
  formatActionCenterListHint,
  resolveListItemDisplayStatus,
  shouldApplyWaitingListStyle,
  shouldShowDueInList,
  shouldShowPriorityInList,
} from "@/lib/task-action-display";

describe("task-action-display", () => {
  it("uses effectiveStatus for list badge when present", () => {
    expect(
      resolveListItemDisplayStatus({ status: "CHECKING", effectiveStatus: "COMPLETED" }),
    ).toBe("COMPLETED");
  });

  it("does not show waiting hint when effectiveStatus is COMPLETED", () => {
    expect(
      formatActionCenterListHint(
        {
          status: "CHECKING",
          effectiveStatus: "COMPLETED",
          isWaitingOnOthers: true,
          waitingOnAssignee: "Design Head",
          waitingOnStage: "Sketch Approval",
        },
        "upcoming",
      ),
    ).toBe("Your stage is done · design continues in pipeline");
  });

  it("shows pipeline hint on completed tab when work continues", () => {
    expect(
      formatActionCenterListHint(
        { status: "CHECKING", effectiveStatus: "COMPLETED", isWaitingOnOthers: true },
        "completed",
      ),
    ).toBe("Your stage is done · design continues in pipeline");
  });

  it("applies waiting list style only for upcoming CHECKING display status", () => {
    expect(
      shouldApplyWaitingListStyle({ status: "CHECKING", effectiveStatus: "CHECKING" }, "upcoming"),
    ).toBe(true);
    expect(
      shouldApplyWaitingListStyle({ status: "CHECKING", effectiveStatus: "COMPLETED" }, "upcoming"),
    ).toBe(false);
    expect(
      shouldApplyWaitingListStyle({ status: "CHECKING", effectiveStatus: "CHECKING" }, "completed"),
    ).toBe(false);
  });

  it("hides priority and due hints on completed variant", () => {
    expect(shouldShowPriorityInList("completed")).toBe(false);
    expect(shouldShowDueInList("completed")).toBe(false);
    expect(shouldShowPriorityInList("active")).toBe(true);
    expect(shouldShowDueInList("active")).toBe(true);
  });

  it("formats completed-at hint for completed tab", () => {
    const today = new Date();
    expect(formatActionCenterListHint({ status: "COMPLETED", completedAt: today }, "completed")).toBe(
      "Completed today",
    );
  });

  it("formats waiting hint for CHECKING upcoming tasks", () => {
    expect(
      formatActionCenterListHint(
        {
          status: "CHECKING",
          waitingOnAssignee: "Design Head",
          waitingOnStage: "Sketch Approval",
        },
        "upcoming",
      ),
    ).toBe("Submitted · waiting on Design Head (Sketch Approval)");
  });

  it("formats relative completed dates", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatActionCenterCompletedAt(yesterday)).toBe("Completed yesterday");
  });
});
