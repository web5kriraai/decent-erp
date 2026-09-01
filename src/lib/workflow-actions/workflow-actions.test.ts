import { describe, expect, it } from "vitest";
import {
  resolveCostingContextActions,
  resolveDesignContextActions,
  resolveTaskContextActions,
} from "@/lib/workflow-actions/resolve";
import { WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions/types";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

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

describe("workflow-actions resolve", () => {
  it("disables request approval with stage list when work is incomplete", () => {
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
    });

    const request = actions.find((a) => a.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL);
    expect(request?.enabled).toBe(false);
    expect(request?.disabledReason).toMatch(/Sketch/);
  });

  it("exposes start task disabled reason when dependency blocks", () => {
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

    const start = actions.find((a) => a.code === WORKFLOW_ACTION_CODES.START_TASK);
    expect(start?.enabled).toBe(false);
    expect(start?.disabledReason).toMatch(/Sketch/);
  });

  it("blocks add cost when no design selected", () => {
    const actions = resolveCostingContextActions({
      permissions: [PERMISSIONS.COST_VIEW],
    });
    const add = actions.find((a) => a.code === WORKFLOW_ACTION_CODES.ADD_COST);
    expect(add?.enabled).toBe(false);
    expect(add?.disabledReason).toMatch(/Select a design/);
  });
});
