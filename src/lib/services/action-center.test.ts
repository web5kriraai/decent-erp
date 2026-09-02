import { describe, expect, it } from "vitest";
import {
  buildBlockedContext,
  categorizeEmployeeTask,
  findDependencyBlocker,
  foldWaitingTaskToPersonalBucket,
  type DepSibling,
} from "./action-center";

function sibling(
  id: string,
  sequence: number,
  status: string,
  opts?: Partial<DepSibling>,
): DepSibling {
  return {
    id,
    dependencySequence: sequence,
    sequence,
    status,
    subProcess: opts?.subProcess ?? { name: `Stage ${sequence}`, code: `STAGE_${sequence}`, isApproval: false },
    assignedEmployee: opts?.assignedEmployee ?? { name: "Worker" },
  };
}

describe("categorizeEmployeeTask", () => {
  const siblings: DepSibling[] = [
    sibling("1", 1, "COMPLETED", { subProcess: { name: "Sketch", code: "SKETCH", isApproval: false } }),
    sibling("2", 2, "ASSIGNED", {
      subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
      assignedEmployee: { name: "Design Head" },
    }),
    sibling("3", 3, "PENDING", {
      subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      assignedEmployee: { name: "Punch Designer" },
    }),
  ];

  it("marks ready ASSIGNED task as actionRequired", () => {
    const task = {
      id: "2",
      status: "ASSIGNED",
      dependencySequence: 2,
      sequence: 2,
      subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
      assignedEmployeeId: 10,
    };
    expect(categorizeEmployeeTask(task, siblings)).toBe("actionRequired");
  });

  it("marks ready ASSIGNED sketch as actionRequired when sketch approval is open", () => {
    const sketchFlow: DepSibling[] = [
      {
        id: "1",
        dependencySequence: null,
        sequence: 1,
        status: "COMPLETED",
        subProcess: { name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true },
        assignedEmployee: { name: "Design Head" },
      },
      {
        id: "2",
        dependencySequence: null,
        sequence: 2,
        status: "ASSIGNED",
        subProcess: { name: "Sketch Creation", code: "SKETCH", isApproval: false },
        assignedEmployee: { name: "Ravi Sketch" },
      },
      {
        id: "3",
        dependencySequence: 1,
        sequence: 3,
        status: "ASSIGNED",
        subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        assignedEmployee: { name: "Design Head" },
      },
    ];
    const sketchTask = {
      id: "2",
      status: "ASSIGNED",
      dependencySequence: null,
      sequence: 2,
      subProcess: { name: "Sketch Creation", code: "SKETCH", isApproval: false },
      assignedEmployeeId: 3,
    };
    expect(categorizeEmployeeTask(sketchTask, sketchFlow)).toBe("actionRequired");
  });

  it("marks CHECKING work task as waitingForOthers", () => {
    const task = {
      id: "1",
      status: "CHECKING",
      dependencySequence: 1,
      sequence: 1,
      subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
      assignedEmployeeId: 5,
    };
    expect(categorizeEmployeeTask(task, siblings)).toBe("waitingForOthers");
  });

  it("marks PENDING task blocked by an earlier stage as waitingForOthers", () => {
    const blockedSiblings: DepSibling[] = [
      sibling("1", 1, "RUNNING"),
      sibling("2", 2, "PENDING", { assignedEmployee: { name: "Me" } }),
    ];
    const task = {
      id: "2",
      status: "PENDING",
      dependencySequence: 2,
      sequence: 2,
      subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      assignedEmployeeId: 5,
    };
    expect(categorizeEmployeeTask(task, blockedSiblings)).toBe("waitingForOthers");
  });

  it("marks ready PENDING task as actionRequired", () => {
    const readySiblings: DepSibling[] = [
      sibling("1", 1, "COMPLETED"),
      sibling("2", 2, "PENDING", { assignedEmployee: { name: "Me" } }),
    ];
    const task = {
      id: "2",
      status: "PENDING",
      dependencySequence: 2,
      sequence: 2,
      subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      assignedEmployeeId: 5,
    };
    expect(categorizeEmployeeTask(task, readySiblings)).toBe("actionRequired");
  });

  it("finds dependency blocker", () => {
    const blockedSiblings: DepSibling[] = [
      sibling("1", 1, "RUNNING"),
      sibling("2", 2, "PENDING", { assignedEmployee: { name: "Me" } }),
    ];
    const task = {
      id: "2",
      status: "PENDING",
      dependencySequence: 2,
      sequence: 2,
      subProcess: null,
      assignedEmployeeId: 5,
    };
    const blocker = findDependencyBlocker(task, blockedSiblings);
    expect(blocker?.id).toBe("1");
  });

  it("treats CHECKING without an approval gate as completed for the assignee", () => {
    const siblings: DepSibling[] = [
      sibling("4", 4, "CHECKING", { subProcess: { name: "Punch", code: "PUNCH", isApproval: false } }),
      sibling("5", 5, "ASSIGNED", { subProcess: { name: "Machine", code: "MACHINE_SAMPLE", isApproval: false } }),
    ];
    const task = {
      id: "4",
      status: "CHECKING",
      dependencySequence: 4,
      sequence: 4,
      subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      assignedEmployeeId: 4,
    };
    expect(categorizeEmployeeTask(task, siblings)).toBe("completed");
  });

  it("folds CHECKING without an approval gate to Completed using effectiveStatus", () => {
    const noGate: DepSibling[] = [
      sibling("4", 4, "CHECKING", { subProcess: { name: "Punch", code: "PUNCH", isApproval: false } }),
      sibling("5", 5, "ASSIGNED", { subProcess: { name: "Machine", code: "MACHINE_SAMPLE", isApproval: false } }),
    ];
    const task = {
      id: "4",
      status: "CHECKING",
      dependencySequence: 4,
      sequence: 4,
      subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      assignedEmployeeId: 4,
    };
    expect(foldWaitingTaskToPersonalBucket(task, noGate)).toBe("completed");
  });

  it("folds CHECKING work that still has an approval gate to Upcoming", () => {
    const task = {
      id: "1",
      status: "CHECKING",
      dependencySequence: 1,
      sequence: 1,
      subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
      assignedEmployeeId: 5,
    };
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("upcoming");
  });

  it("buildBlockedContext includes owner and human message", () => {
    const blockedSiblings: DepSibling[] = [
      sibling("1", 1, "RUNNING", {
        subProcess: { name: "Fabric Issue", code: "FABRIC_ISSUE", isApproval: false },
        assignedEmployee: { name: "Production Head" },
      }),
      sibling("2", 2, "ASSIGNED", {
        subProcess: { name: "Machine Sample", code: "MACHINE_SAMPLE", isApproval: false },
        assignedEmployee: { name: "Machine Op" },
      }),
    ];
    const task = {
      id: "2",
      status: "ASSIGNED",
      dependencySequence: 2,
      sequence: 2,
      subProcess: { name: "Machine Sample", code: "MACHINE_SAMPLE", isApproval: false },
      assignedEmployeeId: 5,
    };
    const ctx = buildBlockedContext(task, blockedSiblings);
    expect(ctx.blockedBy).toBe("Fabric Issue");
    expect(ctx.blockedOwner).toBe("Production Head");
    expect(ctx.blockedMessage).toContain("Fabric Issue");
    expect(ctx.blockedMessage).toContain("Production Head");
  });
});
