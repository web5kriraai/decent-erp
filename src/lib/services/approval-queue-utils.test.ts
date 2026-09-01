import { describe, expect, it } from "vitest";
import {
  buildPendingApprovalItems,
  canEmployeeActOnApprovalLevel,
  isDesignReadyForSignOff,
  readyForSignOffScopeFilter,
} from "@/lib/services/approval-queue-utils";

describe("canEmployeeActOnApprovalLevel", () => {
  it("allows admin on any level", () => {
    expect(
      canEmployeeActOnApprovalLevel({ requiredRoleId: 99 }, 1, "ADMIN"),
    ).toBe(true);
  });

  it("allows matching role", () => {
    expect(
      canEmployeeActOnApprovalLevel({ requiredRoleId: 5 }, 5, "DESIGN_HEAD"),
    ).toBe(true);
  });

  it("denies non-matching role", () => {
    expect(
      canEmployeeActOnApprovalLevel({ requiredRoleId: 5 }, 3, "SAMPLE_CHECKER"),
    ).toBe(false);
  });

  it("allows any employee when level has no required role", () => {
    expect(
      canEmployeeActOnApprovalLevel({ requiredRoleId: null }, 3, "SAMPLE_CHECKER"),
    ).toBe(true);
  });
});

describe("readyForSignOffScopeFilter", () => {
  it("returns no filter for admin and management", () => {
    expect(readyForSignOffScopeFilter(7, "ADMIN")).toEqual({});
    expect(readyForSignOffScopeFilter(7, "MANAGEMENT")).toEqual({});
  });

  it("scopes design head to their portfolio", () => {
    expect(readyForSignOffScopeFilter(12, "DESIGN_HEAD")).toEqual({
      designHeadEmployeeId: 12,
    });
  });

  it("scopes other roles to their portfolio", () => {
    expect(readyForSignOffScopeFilter(3, "SAMPLE_CHECKER")).toEqual({
      designHeadEmployeeId: 3,
    });
  });
});

describe("buildPendingApprovalItems", () => {
  const levels = [
    { id: 1, code: "CHECKER_APPROVAL", name: "Checker", sequence: 1 },
    { id: 2, code: "DESIGN_HEAD_APPROVAL", name: "Design Head", sequence: 2 },
    { id: 3, code: "MANAGEMENT_APPROVAL", name: "Management", sequence: 3 },
  ];

  it("returns the next unpassed level for a pending design", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 100,
          ideaRef: "IDEA-1",
          collectionName: "Spring",
          status: "APPROVAL_PENDING",
          approvals: [{ approvalLevelId: 1, decision: "APPROVED" }],
          tasks: [],
        },
      ],
      levels,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.currentLevel.id).toBe(2);
    expect(items[0]?.designId).toBe("100");
  });

  it("excludes stuck designs where all levels are already passed", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 101,
          ideaRef: "IDEA-2",
          collectionName: "Summer",
          status: "APPROVAL_PENDING",
          approvals: [
            { approvalLevelId: 1, decision: "APPROVED" },
            { approvalLevelId: 2, decision: "APPROVED" },
            { approvalLevelId: 3, decision: "SKIPPED" },
          ],
          tasks: [],
        },
      ],
      levels,
    );
    expect(items).toEqual([]);
  });
});

describe("isDesignReadyForSignOff", () => {
  const work = (code: string, status: string, isApproval = false) => ({
    status,
    subProcess: { code, isApproval },
  });

  it("returns true when all workflow tasks are satisfied", () => {
    expect(
      isDesignReadyForSignOff([
        work("SKETCH", "COMPLETED"),
        work("SKETCH_APPROVAL", "COMPLETED", true),
        work("PUNCH", "CHECKING"),
        work("COSTING", "COMPLETED"),
        work("FINAL_APPROVAL", "COMPLETED", true),
      ]),
    ).toBe(true);
  });

  it("returns false when a stage approval is still open", () => {
    expect(
      isDesignReadyForSignOff([
        work("SKETCH", "COMPLETED"),
        work("SKETCH_APPROVAL", "ASSIGNED", true),
      ]),
    ).toBe(false);
  });

  it("returns false when a work task is still in progress", () => {
    expect(
      isDesignReadyForSignOff([
        work("SKETCH", "RUNNING"),
        work("SKETCH_APPROVAL", "COMPLETED", true),
      ]),
    ).toBe(false);
  });

  it("ignores correction subprocess when checking completion", () => {
    expect(
      isDesignReadyForSignOff([
        work("SKETCH", "COMPLETED"),
        work("CORRECTION", "OPEN"),
        work("FINAL_APPROVAL", "COMPLETED", true),
      ]),
    ).toBe(true);
  });

  it("ignores post-sign-off production tasks still pending", () => {
    expect(
      isDesignReadyForSignOff([
        work("COSTING", "COMPLETED"),
        work("FINAL_APPROVAL", "COMPLETED", true),
        work("PROD_HANDOFF", "PENDING"),
        work("LIVE_REVIEW", "PENDING", true),
      ]),
    ).toBe(true);
  });
});
