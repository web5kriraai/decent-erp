import { describe, expect, it } from "vitest";
import {
  findStageApprovalGate,
  findCheckingWorkTasksReleasedByApproval,
  resolveEffectiveTaskStatus,
  resolveWorkTaskEndStatus,
} from "@/lib/services/workflow-stage-gate";
import type { StageGateSibling } from "@/lib/services/workflow-stage-gate";

function stage(
  id: string,
  sequence: number,
  status: string,
  opts?: Partial<StageGateSibling>,
): StageGateSibling {
  return {
    id,
    dependencySequence: sequence,
    sequence,
    status,
    subProcess: opts?.subProcess ?? { name: `Stage ${sequence}`, code: `STAGE_${sequence}`, isApproval: false },
    assignedEmployee: opts?.assignedEmployee ?? { name: "Worker" },
    assignedEmployeeId: opts?.assignedEmployeeId ?? 1,
  };
}

describe("workflow stage gates", () => {
  it("links sketch checking to the immediate sketch approval gate", () => {
    const siblings: StageGateSibling[] = [
      stage("1", 1, "COMPLETED", { subProcess: { name: "Concept", code: "CONCEPT", isApproval: true } }),
      stage("2", 2, "CHECKING", { subProcess: { name: "Sketch", code: "SKETCH", isApproval: false } }),
      stage("3", 3, "ASSIGNED", {
        subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        assignedEmployeeId: 10,
      }),
    ];

    const gate = findStageApprovalGate(
      { id: "2", dependencySequence: 2, sequence: 2, subProcess: { isApproval: false } },
      siblings,
    );

    expect(gate?.id).toBe("3");
  });

  it("does not treat sample check as the gate for a checking punch when machine work is still open", () => {
    const siblings: StageGateSibling[] = [
      stage("4", 4, "CHECKING", { subProcess: { name: "Punch", code: "PUNCH", isApproval: false } }),
      stage("5", 5, "ASSIGNED", { subProcess: { name: "Machine Sample", code: "MACHINE_SAMPLE", isApproval: false } }),
      stage("6", 6, "ASSIGNED", {
        subProcess: { name: "Sample Checking", code: "SAMPLE_CHECK", isApproval: true },
        assignedEmployeeId: 6,
      }),
    ];

    const gate = findStageApprovalGate(
      { id: "4", dependencySequence: 4, sequence: 4, subProcess: { isApproval: false } },
      siblings,
    );

    expect(gate).toBeNull();
    expect(
      resolveWorkTaskEndStatus(
        { id: "4", dependencySequence: 4, sequence: 4, subProcess: { isApproval: false } },
        siblings,
        "CHECKING",
      ),
    ).toBe("COMPLETED");
  });

  it("forces CHECKING when a stage-approval gate exists even if COMPLETED was requested", () => {
    const siblings: StageGateSibling[] = [
      stage("2", 2, "RUNNING", { subProcess: { name: "Sketch", code: "SKETCH", isApproval: false } }),
      stage("3", 3, "PENDING", {
        subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        assignedEmployeeId: 10,
      }),
    ];

    expect(
      resolveWorkTaskEndStatus(
        { id: "2", dependencySequence: 2, sequence: 2, subProcess: { isApproval: false } },
        siblings,
        "COMPLETED",
      ),
    ).toBe("CHECKING");
  });

  it("resolves machine sample to COMPLETED once sample checking is finished", () => {
    const siblings: StageGateSibling[] = [
      stage("5", 5, "CHECKING", { subProcess: { name: "Machine Sample", code: "MACHINE_SAMPLE", isApproval: false } }),
      stage("6", 6, "COMPLETED", {
        subProcess: { name: "Sample Checking", code: "SAMPLE_CHECK", isApproval: true },
      }),
    ];

    expect(
      resolveEffectiveTaskStatus(
        { id: "5", dependencySequence: 5, sequence: 5, status: "CHECKING", subProcess: { isApproval: false } },
        siblings,
      ),
    ).toBe("COMPLETED");

    expect(
      findCheckingWorkTasksReleasedByApproval(
        { id: "6", dependencySequence: 6, sequence: 6 },
        siblings,
      ).map((t) => t.id),
    ).toEqual(["5"]);
  });
});
