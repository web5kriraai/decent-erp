import { describe, expect, it } from "vitest";
import {
  buildWorkflowSteps,
  getDesignWorkflowActions,
  getDesignWorkflowContext,
  getPendingStageApproval,
  getWorkflowStatusMessage,
  isWorkflowStepAssignable,
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

  it("marks only the first open stage as current in the workflow rail", () => {
    const design: DesignSummary = {
      ...baseDesign,
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
          status: "COMPLETED",
          subProcess: { id: 3, name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        }),
        task({
          id: "t4",
          sequence: 4,
          status: "CHECKING",
          subProcess: { id: 4, name: "Punching / Wilcom", code: "PUNCH" },
        }),
        task({
          id: "t5",
          sequence: 5,
          status: "ASSIGNED",
          subProcess: { id: 5, name: "Machine Sample", code: "MACHINE_SAMPLE" },
        }),
      ],
    };

    const steps = buildWorkflowSteps(design.tasks);
    const current = steps.filter((s) => s.isCurrent);

    expect(current).toHaveLength(1);
    expect(current[0]?.code).toBe("MACHINE_SAMPLE");
    expect(isWorkflowStepAssignable("CHECKING")).toBe(false);
    expect(isWorkflowStepAssignable("ASSIGNED")).toBe(true);
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

  it("surfaces final approval after costing is submitted for checking", () => {
    const design: DesignSummary = {
      ...baseDesign,
      tasks: [
        task({ id: "t1", sequence: 1, status: "COMPLETED", subProcess: { id: 1, name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true } }),
        task({ id: "t6", sequence: 6, status: "COMPLETED", subProcess: { id: 6, name: "Sample Checking", code: "SAMPLE_CHECK", isApproval: true } }),
        task({
          id: "t7",
          sequence: 7,
          status: "CHECKING",
          subProcess: { id: 7, name: "Costing", code: "COSTING" },
        }),
        task({
          id: "t8",
          sequence: 8,
          status: "ASSIGNED",
          assignedEmployeeId: 10,
          subProcess: { id: 8, name: "Final Approval", code: "FINAL_APPROVAL", isApproval: true },
        }),
      ],
    };

    const pending = getPendingStageApproval({
      design,
      employeeId: 10,
      canApprove: true,
      canExecute: true,
    });

    expect(pending?.approvalTask.id).toBe("t8");
    expect(pending?.workTask?.id).toBe("t7");
  });

  it("marks sample checking as current and locks upcoming costing stages", () => {
    const design: DesignSummary = {
      ...baseDesign,
      tasks: [
        task({ id: "t1", sequence: 1, status: "COMPLETED", subProcess: { id: 1, name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true } }),
        task({ id: "t2", sequence: 2, status: "COMPLETED", subProcess: { id: 2, name: "Sketch Creation", code: "SKETCH" } }),
        task({ id: "t3", sequence: 3, status: "COMPLETED", subProcess: { id: 3, name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true } }),
        task({ id: "t4", sequence: 4, status: "COMPLETED", subProcess: { id: 4, name: "Punching / Wilcom", code: "PUNCH" } }),
        task({
          id: "t5",
          sequence: 5,
          status: "ASSIGNED",
          assignedEmployee: { id: 5, name: "Machine Op", employeeCode: "EMP005" },
          subProcess: { id: 5, name: "Machine Sample", code: "MACHINE_SAMPLE" },
        }),
        task({
          id: "t6",
          sequence: 6,
          status: "RUNNING",
          assignedEmployee: { id: 6, name: "Anita Checker", employeeCode: "EMP006" },
          subProcess: { id: 6, name: "Sample Checking", code: "SAMPLE_CHECK", isApproval: true },
        }),
        task({ id: "t7", sequence: 7, status: "PENDING", subProcess: { id: 7, name: "Costing", code: "COSTING" } }),
        task({ id: "t8", sequence: 8, status: "PENDING", subProcess: { id: 8, name: "Final Approval", code: "FINAL_APPROVAL", isApproval: true } }),
      ],
    };

    const steps = buildWorkflowSteps(design.tasks);
    const current = steps.find((s) => s.isCurrent);
    const machineSample = steps.find((s) => s.code === "MACHINE_SAMPLE");
    const costing = steps.find((s) => s.code === "COSTING");
    const finalApproval = steps.find((s) => s.code === "FINAL_APPROVAL");

    expect(current?.code).toBe("SAMPLE_CHECK");
    expect(current?.displayStatus).toBe("IN_PROGRESS");
    expect(machineSample?.isDone).toBe(false);
    expect(machineSample?.displayStatus).toBe("ASSIGNED");
    expect(machineSample?.canReassign).toBe(true);
    expect(costing?.isUpcoming).toBe(true);
    expect(costing?.canReassign).toBe(false);
    expect(finalApproval?.isUpcoming).toBe(true);
    expect(finalApproval?.canReassign).toBe(false);

    const ctx = getDesignWorkflowContext({ status: "ACTIVE", tasks: design.tasks });
    expect(ctx.nextActionHint).toContain("Approve / Request Re-sample");
  });

  it("shows machine sample as completed when sample checking is already done", () => {
    const design: DesignSummary = {
      ...baseDesign,
      tasks: [
        task({ id: "t1", sequence: 1, status: "COMPLETED", subProcess: { id: 1, name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true } }),
        task({ id: "t2", sequence: 2, status: "COMPLETED", subProcess: { id: 2, name: "Sketch Creation", code: "SKETCH" } }),
        task({ id: "t3", sequence: 3, status: "COMPLETED", subProcess: { id: 3, name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true } }),
        task({ id: "t4", sequence: 4, status: "COMPLETED", subProcess: { id: 4, name: "Punching / Wilcom", code: "PUNCH" } }),
        task({ id: "t5", sequence: 5, status: "CHECKING", subProcess: { id: 5, name: "Machine Sample", code: "MACHINE_SAMPLE" } }),
        task({ id: "t6", sequence: 6, status: "COMPLETED", subProcess: { id: 6, name: "Sample Checking", code: "SAMPLE_CHECK", isApproval: true } }),
        task({ id: "t7", sequence: 7, status: "ASSIGNED", subProcess: { id: 7, name: "Costing", code: "COSTING" } }),
        task({ id: "t8", sequence: 8, status: "PENDING", subProcess: { id: 8, name: "Final Approval", code: "FINAL_APPROVAL", isApproval: true } }),
      ],
    };

    const steps = buildWorkflowSteps(design.tasks);
    const machineSample = steps.find((s) => s.code === "MACHINE_SAMPLE");
    const costing = steps.find((s) => s.isCurrent);

    expect(machineSample?.isDone).toBe(true);
    expect(machineSample?.displayStatus).toBe("COMPLETED");
    expect(machineSample?.canReassign).toBe(false);
    expect(costing?.code).toBe("COSTING");
  });
});
