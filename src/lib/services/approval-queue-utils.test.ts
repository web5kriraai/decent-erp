import { describe, expect, it } from "vitest";
import {
  buildPendingApprovalItems,
  canEmployeeActOnApprovalLevel,
  isDesignReadyForSignOff,
  pickRelatedApprovalTask,
  readyForSignOffScopeFilter,
} from "@/lib/services/approval-queue-utils";

describe("canEmployeeActOnApprovalLevel", () => {
  it("allows admin to act on role-scoped management levels", () => {
    expect(
      canEmployeeActOnApprovalLevel(
        { requiredRoleId: 99, code: "CHECKER_APPROVAL" },
        1,
        "ADMIN",
      ),
    ).toBe(true);
  });

  it("allows matching role", () => {
    expect(
      canEmployeeActOnApprovalLevel(
        { requiredRoleId: 5, code: "DESIGN_HEAD_APPROVAL" },
        5,
        "DESIGN_HEAD",
      ),
    ).toBe(true);
  });

  it("denies non-matching role", () => {
    expect(
      canEmployeeActOnApprovalLevel(
        { requiredRoleId: 5, code: "DESIGN_HEAD_APPROVAL" },
        3,
        "SAMPLE_CHECKER",
      ),
    ).toBe(false);
  });

  it("allows admin to act on any management level", () => {
    expect(
      canEmployeeActOnApprovalLevel(
        { requiredRoleId: 10, code: "CHECKER_APPROVAL" },
        99,
        "ADMIN",
      ),
    ).toBe(true);
    expect(
      canEmployeeActOnApprovalLevel(
        { requiredRoleId: 30, code: "MANAGEMENT_APPROVAL" },
        99,
        "ADMIN",
      ),
    ).toBe(true);
  });
});

describe("readyForSignOffScopeFilter", () => {
  it("scopes every role to their portfolio", () => {
    expect(readyForSignOffScopeFilter(7, "ADMIN")).toEqual({ designHeadEmployeeId: 7 });
    expect(readyForSignOffScopeFilter(7, "MANAGEMENT")).toEqual({ designHeadEmployeeId: 7 });
    expect(readyForSignOffScopeFilter(12, "DESIGN_HEAD")).toEqual({
      designHeadEmployeeId: 12,
    });
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
    expect(items[0]?.nextLevelName).toBe("Management");
  });

  it("exposes stage assignees for correction preview", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 110,
          ideaRef: "IDEA-ASSIGNEES",
          collectionName: "Spring",
          status: "APPROVAL_PENDING",
          approvals: [],
          tasks: [
            {
              id: 1,
              status: "COMPLETED",
              sequence: 1,
              assignedEmployeeId: 5,
              process: { name: "Design" },
              subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
              assignedEmployee: { id: 5, name: "Punch Operator" },
            },
            {
              id: 2,
              status: "COMPLETED",
              sequence: 2,
              process: { name: "QC" },
              subProcess: { name: "Final Approval", code: "FINAL_APPROVAL", isApproval: true },
            },
          ],
        },
      ],
      levels,
    );
    expect(items[0]?.stageAssignees).toEqual([
      {
        code: "PUNCH",
        name: "Punch",
        assigneeEmployeeId: 5,
        assigneeName: "Punch Operator",
      },
    ]);
    expect(items[0]?.nextLevelName).toBe("Design Head");
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

  it("picks the latest completed work task as related task", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 102,
          ideaRef: "IDEA-3",
          collectionName: "Festive",
          status: "APPROVAL_PENDING",
          approvals: [],
          tasks: [
            {
              id: 1,
              status: "COMPLETED",
              sequence: 1,
              process: { name: "Design" },
              subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
            },
            {
              id: 2,
              status: "COMPLETED",
              sequence: 3,
              process: { name: "Design" },
              subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
            },
            {
              id: 3,
              status: "ASSIGNED",
              sequence: 4,
              process: { name: "QC" },
              subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
            },
          ],
        },
      ],
      levels,
    );
    expect(items[0]?.task?.subProcess.name).toBe("Punch");
  });
  it("marks final level as not costing-ready when design has no costs", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 103,
          ideaRef: "IDEA-4",
          collectionName: "Winter",
          status: "APPROVAL_PENDING",
          approvals: [
            { approvalLevelId: 1, decision: "APPROVED" },
            { approvalLevelId: 2, decision: "APPROVED" },
          ],
          tasks: [],
        },
      ],
      levels,
      { designIdsWithCosting: new Set() },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.currentLevel.code).toBe("MANAGEMENT_APPROVAL");
    expect(items[0]?.costingReady).toBe(false);
  });
});

describe("pickRelatedApprovalTask", () => {
  it("prefers costing for management approval level", () => {
    const tasks = [
      {
        id: 1,
        status: "COMPLETED",
        sequence: 1,
        process: { name: "Design" },
        subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
      },
      {
        id: 2,
        status: "COMPLETED",
        sequence: 9,
        process: { name: "Finance" },
        subProcess: { name: "Costing", code: "COSTING", isApproval: false },
      },
    ];
    expect(pickRelatedApprovalTask(tasks, "MANAGEMENT_APPROVAL")?.subProcess.code).toBe("COSTING");
  });
});

describe("role-filtered pending approvals", () => {
  const levels = [
    { id: 1, code: "CHECKER_APPROVAL", name: "Checker", sequence: 1, requiredRoleId: 10 },
    { id: 2, code: "DESIGN_HEAD_APPROVAL", name: "Design Head", sequence: 2, requiredRoleId: 20 },
  ];

  it("filters items to the employee role that can act on the current level", () => {
    const items = buildPendingApprovalItems(
      [
        {
          id: 200,
          ideaRef: "IDEA-X",
          collectionName: "Winter",
          status: "APPROVAL_PENDING",
          approvals: [],
          tasks: [],
        },
      ],
      levels,
    );

    const checkerItems = items.filter((item) =>
      canEmployeeActOnApprovalLevel(
        { ...item.currentLevel, code: "CHECKER_APPROVAL" },
        10,
        "SAMPLE_CHECKER",
      ),
    );
    const designHeadItems = items.filter((item) =>
      canEmployeeActOnApprovalLevel(
        { ...item.currentLevel, code: "DESIGN_HEAD_APPROVAL" },
        20,
        "DESIGN_HEAD",
      ),
    );

    expect(checkerItems).toHaveLength(1);
    expect(designHeadItems).toHaveLength(0);
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

  it("blocks ready-for-sign-off while RESAMPLE is still open", () => {
    expect(
      isDesignReadyForSignOff([
        work("SAMPLE_CHECK", "COMPLETED"),
        work("COSTING", "COMPLETED"),
        work("FINAL_APPROVAL", "COMPLETED", true),
        work("RESAMPLE", "ASSIGNED"),
      ]),
    ).toBe(false);
  });
});
