import { describe, expect, it } from "vitest";
import {
  buildWorkflowSteps,
  getDesignWorkflowActions,
  getPendingStageApproval,
  getWorkflowStatusMessage,
} from "@/lib/design-workflow";
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

describe("design workflow actions", () => {
  const baseDesign: DesignSummary = {
    id: "1",
    ideaRef: "IDEA-1",
    collectionName: "Test Collection",
    status: "ACTIVE",
    priority: "MEDIUM",
    tasks: [
      task({
        id: "t1",
        sequence: 1,
        status: "COMPLETED",
        subProcess: { id: 1, name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true },
      }),
      task({
        id: "t2",
        sequence: 2,
        status: "CHECKING",
        subProcess: { id: 2, name: "Sketch Creation", code: "SKETCH" },
      }),
      task({
        id: "t3",
        sequence: 3,
        status: "ASSIGNED",
        assignedEmployeeId: 10,
        subProcess: { id: 3, name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
      }),
    ],
  };

  it("surfaces sketch approval inline for design head after sketch is submitted", () => {
    const pending = getPendingStageApproval({
      design: baseDesign,
      employeeId: 10,
      canApprove: true,
      canExecute: true,
    });

    expect(pending?.approvalTask.id).toBe("t3");
    expect(pending?.workTask?.id).toBe("t2");
  });

  it("does not show request final approval while a stage approval is still open", () => {
    const actions = getDesignWorkflowActions({
      design: baseDesign,
      employeeId: 10,
      canApprove: true,
      canExecute: true,
      approvalsQueueHref: "/quality/approvals",
    });

    expect(actions.some((a) => a.label === "Request Final Approval")).toBe(false);
  });

  it("shows request final approval only when no open stage actions remain", () => {
    const completedDesign: DesignSummary = {
      ...baseDesign,
      tasks: baseDesign.tasks!.map((t) => ({ ...t, status: "COMPLETED" })),
    };

    const actions = getDesignWorkflowActions({
      design: completedDesign,
      employeeId: 10,
      canApprove: true,
      canExecute: true,
      approvalsQueueHref: "/quality/approvals",
    });

    expect(actions.some((a) => a.label === "Request Final Approval")).toBe(true);
  });

  it("prefers sketch approval when sketch is checking even if concept review is checking", () => {
    const design: DesignSummary = {
      ...baseDesign,
      tasks: [
        task({
          id: "t1",
          sequence: 1,
          status: "CHECKING",
          subProcess: { id: 1, name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true },
        }),
        task({
          id: "t2",
          sequence: 2,
          status: "CHECKING",
          subProcess: { id: 2, name: "Sketch Creation", code: "SKETCH" },
        }),
        task({
          id: "t3",
          sequence: 3,
          status: "CHECKING",
          assignedEmployeeId: 10,
          subProcess: { id: 3, name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        }),
      ],
    };

    const pending = getPendingStageApproval({
      design,
      employeeId: 10,
      canApprove: true,
      canExecute: true,
    });

    expect(pending?.approvalTask.id).toBe("t3");
    expect(pending?.workTask?.id).toBe("t2");
  });
});
