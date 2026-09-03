import { describe, expect, it } from "vitest";
import {
  resolveApprovalContextActions,
  resolveCorrectionContextActions,
  resolveCostingContextActions,
  resolveDesignContextActions,
  resolveProductionContextActions,
  resolveTaskContextActions,
} from "@/lib/workflow-actions/resolve";
import { WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions/types";
import { PERMISSIONS } from "@/lib/permissions";
import type { CorrectionRecord, DesignSummary, DesignTask } from "@/lib/types/api";

function task(
  partial: Partial<DesignTask> & Pick<DesignTask, "id" | "sequence" | "status" | "subProcess">,
): DesignTask {
  return {
    priority: "MEDIUM",
    expectedMinutes: 60,
    version: 1,
    design: { id: "1", ideaRef: "IDEA-1", collectionName: "Test" },
    process: { id: 1, name: "Design", code: "DESIGN" },
    ...partial,
  };
}

function correction(status: string): CorrectionRecord {
  return {
    id: "c1",
    correctionType: "MISTAKE",
    status: status as CorrectionRecord["status"],
    design: { id: "1", ideaRef: "IDEA-1", collectionName: "Test" },
    task: {
      id: "t1",
      process: { id: 1, name: "Design", code: "DESIGN" },
      subProcess: { id: 1, name: "Sketch", code: "SKETCH" },
    },
  } as CorrectionRecord;
}

describe("workflow-actions resolve", () => {
  it("hides request approval when work is incomplete", () => {
    const design: DesignSummary = {
      id: "1",
      ideaRef: "IDEA-1",
      collectionName: "Test",
      status: "ACTIVE",
      priority: "MEDIUM",
      tasks: [
        task({
          id: "t1",
          sequence: 1,
          status: "ASSIGNED",
          subProcess: { id: 1, name: "Sketch", code: "SKETCH" },
        }),
      ],
    };

    const actions = resolveDesignContextActions({
      design,
      permissions: [PERMISSIONS.DESIGN_APPROVE],
      roleCode: "DESIGN_HEAD",
    });

    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL)).toBeUndefined();
  });

  it("hides start task when dependency blocks", () => {
    const actions = resolveTaskContextActions({
      task: {
        id: "t2",
        designId: "1",
        status: "ASSIGNED",
        sequence: 2,
        dependencySequence: 2,
        assignedEmployeeId: 1,
        workflowPeers: [
          {
            id: "t1",
            sequence: 1,
            dependencySequence: 1,
            status: "RUNNING",
            assignedEmployeeId: 2,
            subProcess: { name: "Sketch", code: "SKETCH" },
            assignedEmployee: { name: "Alice" },
          },
        ],
      },
      isAssignee: true,
      permissions: [PERMISSIONS.TASK_EXECUTE],
    });

    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.START_TASK)).toBeUndefined();
  });

  it("omits add cost when no design selected", () => {
    const actions = resolveCostingContextActions({
      permissions: [PERMISSIONS.COST_VIEW],
    });
    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.ADD_COST)).toBeUndefined();
  });

  it.each([
    {
      name: "Assignee + TASK_EXECUTE | ASSIGNED + ready | START | Allow",
      input: {
        task: {
          id: "t1",
          designId: "1",
          status: "ASSIGNED",
          sequence: 1,
          dependencySequence: 1,
          assignedEmployeeId: 1,
          workflowPeers: [] as [],
        },
        isAssignee: true,
        permissions: [PERMISSIONS.TASK_EXECUTE],
      },
      code: WORKFLOW_ACTION_CODES.START_TASK,
      expected: "allow" as const,
    },
    {
      name: "Non-assignee | RUNNING | HOLD | Deny (hidden)",
      input: {
        task: {
          id: "t1",
          designId: "1",
          status: "RUNNING",
          sequence: 1,
          dependencySequence: 1,
          assignedEmployeeId: 1,
        },
        isAssignee: false,
        permissions: [PERMISSIONS.TASK_EXECUTE],
      },
      code: WORKFLOW_ACTION_CODES.HOLD_TASK,
      expected: "hidden" as const,
    },
    {
      name: "Assignee | RUNNING | HOLD | Allow",
      input: {
        task: {
          id: "t1",
          designId: "1",
          status: "RUNNING",
          sequence: 1,
          dependencySequence: 1,
          assignedEmployeeId: 1,
        },
        isAssignee: true,
        permissions: [PERMISSIONS.TASK_EXECUTE],
      },
      code: WORKFLOW_ACTION_CODES.HOLD_TASK,
      expected: "allow" as const,
    },
  ])("$name", ({ input, code, expected }) => {
    const actions = resolveTaskContextActions(input);
    const match = actions.find((a) => a.code === code);
    if (expected === "hidden") {
      expect(match).toBeUndefined();
    } else {
      expect(match?.enabled).toBe(true);
    }
  });

  it.each([
    {
      name: "Management | PRODUCTION_RELEASED | MARK_LIVE | Allow",
      roleCode: "MANAGEMENT",
      permissions: [PERMISSIONS.PRODUCTION_RELEASE],
      liveReviewCompleted: true,
      expected: "allow" as const,
    },
    {
      name: "Management | PRODUCTION_RELEASED | live review pending | MARK_LIVE | Deny (hidden)",
      roleCode: "MANAGEMENT",
      permissions: [PERMISSIONS.PRODUCTION_RELEASE],
      liveReviewCompleted: false,
      expected: "hidden" as const,
    },
    {
      name: "Production Head | PRODUCTION_RELEASED | MARK_LIVE | Deny (hidden)",
      roleCode: "PRODUCTION_HEAD",
      permissions: [PERMISSIONS.PRODUCTION_RELEASE],
      liveReviewCompleted: true,
      expected: "hidden" as const,
    },
    {
      name: "No PRODUCTION_RELEASE | any | production actions | Deny (empty)",
      roleCode: "SKETCH_DESIGNER",
      permissions: [PERMISSIONS.TASK_EXECUTE],
      liveReviewCompleted: true,
      expected: "empty" as const,
    },
  ])("$name", ({ roleCode, permissions, liveReviewCompleted, expected }) => {
    const actions = resolveProductionContextActions({
      permissions,
      roleCode,
      designStatus: "PRODUCTION_RELEASED",
      designId: "1",
      liveReviewCompleted,
    });
    if (expected === "empty") {
      expect(actions).toHaveLength(0);
      return;
    }
    const markLive = actions.find((a) => a.code === WORKFLOW_ACTION_CODES.MARK_LIVE);
    if (expected === "hidden") {
      expect(markLive).toBeUndefined();
    } else {
      expect(markLive?.enabled).toBe(true);
    }
  });

  it("omits raise correction when permission missing", () => {
    const actions = resolveCorrectionContextActions({
      permissions: [PERMISSIONS.TASK_EXECUTE],
    });
    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.RAISE_CORRECTION)).toBeUndefined();
  });

  it("exposes complete correction only while open", () => {
    const openActions = resolveCorrectionContextActions({
      permissions: [PERMISSIONS.CORRECTION_RAISE],
      correction: correction("OPEN"),
      includeRaise: false,
    });
    expect(
      openActions.find((a) => a.code === WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION)?.enabled,
    ).toBe(true);

    const doneActions = resolveCorrectionContextActions({
      permissions: [PERMISSIONS.CORRECTION_RAISE],
      correction: correction("DONE"),
      includeRaise: false,
    });
    expect(
      doneActions.find((a) => a.code === WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION),
    ).toBeUndefined();
  });

  it("hides approve when costing is not ready", () => {
    const actions = resolveApprovalContextActions({
      permissions: [PERMISSIONS.DESIGN_APPROVE],
      roleCode: "MANAGEMENT",
      canAccessHub: true,
      approval: { designId: "1", costingReady: false },
    });
    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.APPROVE_LEVEL)).toBeUndefined();
    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.REJECT_LEVEL)?.enabled).toBe(true);
  });

  it("hides costing actions without COST_VIEW", () => {
    expect(resolveCostingContextActions({ permissions: [], designId: "1" })).toHaveLength(0);
  });

  it("does not expose request sign-off on costing surface", () => {
    const actions = resolveCostingContextActions({
      permissions: [PERMISSIONS.COST_VIEW],
      designId: "1",
      hasCosting: true,
    });
    expect(actions.find((a) => a.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL)).toBeUndefined();
  });
});
