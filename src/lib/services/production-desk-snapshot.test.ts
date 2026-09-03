import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import {
  buildProductionDeskLadderSnapshot,
  canOpenProductionDeskNextAction,
  classifyProductionDeskRow,
  PRODUCTION_DESK_STAGE_LABELS,
} from "./production-desk-snapshot";

describe("buildProductionDeskLadderSnapshot", () => {
  it("builds stages and picks the first incomplete next action", () => {
    const snapshot = buildProductionDeskLadderSnapshot([
      {
        id: 10n,
        status: "COMPLETED",
        assignedEmployeeId: 2,
        subProcess: { code: "PROD_HANDOFF" },
        assignedEmployee: { name: "Priya" },
      },
      {
        id: 11n,
        status: "ASSIGNED",
        assignedEmployeeId: 5,
        subProcess: { code: "PROD_INSTRUCTION" },
        assignedEmployee: { name: "Vikram" },
      },
      {
        id: 12n,
        status: "PENDING",
        assignedEmployeeId: 5,
        subProcess: { code: "PROD_RELEASE" },
        assignedEmployee: { name: "Vikram" },
      },
      {
        id: 99n,
        status: "PENDING",
        subProcess: { code: "LIVE_REVIEW" },
        assignedEmployee: { name: "Owner" },
      },
    ]);

    expect(snapshot.stages).toHaveLength(3);
    expect(snapshot.stages[0]).toMatchObject({
      code: "PROD_HANDOFF",
      taskId: "10",
      status: "COMPLETED",
      assigneeId: 2,
    });
    expect(snapshot.nextAction).toEqual({
      code: "PROD_INSTRUCTION",
      taskId: "11",
      label: PRODUCTION_DESK_STAGE_LABELS.PROD_INSTRUCTION,
      status: "ASSIGNED",
      assigneeId: 5,
      assigneeName: "Vikram",
    });
  });

  it("prefers non-cancelled duplicate ladder tasks", () => {
    const snapshot = buildProductionDeskLadderSnapshot([
      {
        id: 1,
        status: "CANCELLED",
        subProcess: { code: "PROD_HANDOFF" },
      },
      {
        id: 2,
        status: "ASSIGNED",
        assignedEmployeeId: 9,
        subProcess: { code: "PROD_HANDOFF" },
        assignedEmployee: { name: "Priya" },
      },
    ]);
    expect(snapshot.nextAction?.taskId).toBe("2");
    expect(snapshot.nextAction?.assigneeId).toBe(9);
  });

  it("returns null nextAction when all ladder stages are done", () => {
    const snapshot = buildProductionDeskLadderSnapshot([
      {
        id: "1",
        status: "COMPLETED",
        subProcess: { code: "PROD_HANDOFF" },
      },
      {
        id: "2",
        status: "COMPLETED",
        subProcess: { code: "PROD_INSTRUCTION" },
      },
      {
        id: "3",
        status: "COMPLETED",
        subProcess: { code: "PROD_RELEASE" },
      },
    ]);
    expect(snapshot.nextAction).toBeNull();
  });

  it("handles missing ladder tasks", () => {
    const snapshot = buildProductionDeskLadderSnapshot([]);
    expect(snapshot.stages.every((s) => s.taskId === null)).toBe(true);
    expect(snapshot.nextAction).toBeNull();
  });
});

describe("classifyProductionDeskRow", () => {
  const emptyStages = [
    { code: "PROD_HANDOFF" as const, taskId: null, status: null, assigneeId: null, assigneeName: null },
    { code: "PROD_INSTRUCTION" as const, taskId: null, status: null, assigneeId: null, assigneeName: null },
    { code: "PROD_RELEASE" as const, taskId: null, status: null, assigneeId: null, assigneeName: null },
  ];

  it("classifies handoff / instruction / ready / missing / blocked", () => {
    expect(
      classifyProductionDeskRow({
        releaseReady: false,
        nextAction: null,
        stages: emptyStages,
      }),
    ).toBe("missing_ladder");

    expect(
      classifyProductionDeskRow({
        releaseReady: false,
        nextAction: {
          code: "PROD_HANDOFF",
          taskId: "1",
          label: "Handoff",
          status: "ASSIGNED",
          assigneeId: 1,
          assigneeName: null,
        },
        stages: [
          { code: "PROD_HANDOFF", taskId: "1", status: "ASSIGNED", assigneeId: 1, assigneeName: null },
          { code: "PROD_INSTRUCTION", taskId: "2", status: "PENDING", assigneeId: null, assigneeName: null },
          { code: "PROD_RELEASE", taskId: "3", status: "PENDING", assigneeId: null, assigneeName: null },
        ],
      }),
    ).toBe("handoff");

    expect(
      classifyProductionDeskRow({
        releaseReady: true,
        nextAction: {
          code: "PROD_RELEASE",
          taskId: "3",
          label: "Release",
          status: "ASSIGNED",
          assigneeId: 5,
          assigneeName: null,
        },
        stages: [
          { code: "PROD_HANDOFF", taskId: "1", status: "COMPLETED", assigneeId: null, assigneeName: null },
          { code: "PROD_INSTRUCTION", taskId: "2", status: "COMPLETED", assigneeId: null, assigneeName: null },
          { code: "PROD_RELEASE", taskId: "3", status: "ASSIGNED", assigneeId: 5, assigneeName: null },
        ],
      }),
    ).toBe("ready");
  });

  it("does not mark PROD_RELEASE as ready when release gate is blocked", () => {
    expect(
      classifyProductionDeskRow({
        releaseReady: false,
        nextAction: {
          code: "PROD_RELEASE",
          taskId: "3",
          label: "Release",
          status: "ASSIGNED",
          assigneeId: 5,
          assigneeName: "Vikram",
        },
        stages: [
          { code: "PROD_HANDOFF", taskId: "1", status: "COMPLETED", assigneeId: null, assigneeName: null },
          { code: "PROD_INSTRUCTION", taskId: "2", status: "COMPLETED", assigneeId: null, assigneeName: null },
          { code: "PROD_RELEASE", taskId: "3", status: "ASSIGNED", assigneeId: 5, assigneeName: "Vikram" },
        ],
      }),
    ).toBe("blocked");
  });
});

describe("canOpenProductionDeskNextAction", () => {
  const next = {
    code: "PROD_INSTRUCTION" as const,
    taskId: "11",
    label: "Instruction",
    status: "ASSIGNED",
    assigneeId: 5,
    assigneeName: "Vikram",
  };

  it("allows only the assignee with TASK_EXECUTE", () => {
    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.PRODUCTION_HEAD,
        permissions: [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.PRODUCTION_RELEASE],
        employeeId: 5,
        nextAction: next,
      }),
    ).toBe(true);

    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.PRODUCTION_HEAD,
        permissions: [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.PRODUCTION_RELEASE],
        employeeId: 99,
        nextAction: next,
      }),
    ).toBe(false);
  });

  it("hides CTA without TASK_EXECUTE even for assignee", () => {
    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.PRODUCTION_HEAD,
        permissions: [PERMISSIONS.PRODUCTION_RELEASE],
        employeeId: 5,
        nextAction: next,
      }),
    ).toBe(false);
  });

  it("does not give Admin a free pass on someone else's assignment", () => {
    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.ADMIN,
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 1,
        nextAction: next,
      }),
    ).toBe(false);
  });

  it("allows owning role when task is unassigned", () => {
    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.DESIGN_HEAD,
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 2,
        nextAction: {
          code: "PROD_HANDOFF",
          taskId: "1",
          label: "Handoff",
          status: "PENDING",
          assigneeId: null,
          assigneeName: null,
        },
      }),
    ).toBe(true);

    expect(
      canOpenProductionDeskNextAction({
        roleCode: ROLE_CODES.PRODUCTION_HEAD,
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 5,
        nextAction: {
          code: "PROD_HANDOFF",
          taskId: "1",
          label: "Handoff",
          status: "PENDING",
          assigneeId: null,
          assigneeName: null,
        },
      }),
    ).toBe(false);
  });
});
