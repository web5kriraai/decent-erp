import { describe, expect, it } from "vitest";
import {
  enrichActionCenterHistoricalList,
  enrichActionCenterTaskList,
} from "@/lib/services/action-center-enrichment";
import type { DepSibling } from "@/lib/services/action-center";

describe("enrichActionCenterTaskList", () => {
  const siblings: DepSibling[] = [
    {
      id: "1",
      dependencySequence: 1,
      sequence: 1,
      status: "COMPLETED",
      assignedEmployeeId: 1,
      subProcess: { name: "Prior", code: "PRIOR", isApproval: false },
      assignedEmployee: { name: "A" },
    },
  ];
  const siblingsByDesign = new Map([["10", siblings]]);

  it("marks canStart false when another task is running", () => {
    const tasks = [
      {
        id: BigInt(2),
        designId: BigInt(10),
        status: "ASSIGNED",
        dependencySequence: 2,
        sequence: 2,
        assignedEmployeeId: 5,
        priority: "HIGH",
        design: { id: BigInt(10), ideaRef: "IDEA-1", collectionName: "C" },
        subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
      },
    ] as const;

    const enriched = enrichActionCenterTaskList([...tasks], siblingsByDesign, BigInt(99));
    expect(enriched[0].canStart).toBe(false);
    expect(enriched[0].startBlockedReason).toMatch(/running task/i);
  });

  it("marks ready ASSIGNED task as canStart when no running task", () => {
    const tasks = [
      {
        id: BigInt(2),
        designId: BigInt(10),
        status: "ASSIGNED",
        dependencySequence: 2,
        sequence: 2,
        assignedEmployeeId: 5,
        priority: "MEDIUM",
        design: { id: BigInt(10), ideaRef: "IDEA-1", collectionName: "C" },
        subProcess: { name: "Sketch", code: "SKETCH", isApproval: false },
      },
    ] as const;

    const enriched = enrichActionCenterTaskList([...tasks], siblingsByDesign, null);
    expect(enriched[0].canStart).toBe(true);
  });

  it("resolves CHECKING sketch without approval gate as effectively completed", () => {
    const tasks = [
      {
        id: BigInt(2),
        designId: BigInt(10),
        status: "CHECKING",
        dependencySequence: 2,
        sequence: 2,
        assignedEmployeeId: 5,
        priority: "URGENT",
        design: { id: BigInt(10), ideaRef: "IDEA-1", collectionName: "C" },
        subProcess: { name: "Sketch Creation", code: "SKETCH", isApproval: false },
      },
    ] as const;

    const enriched = enrichActionCenterHistoricalList([...tasks], siblingsByDesign);
    expect(enriched[0].effectiveStatus).toBe("COMPLETED");
    expect(enriched[0].isWaitingOnOthers).toBe(false);
  });

  it("marks CHECKING punch as completed but still waiting on later pipeline stages", () => {
    const punchSiblings: DepSibling[] = [
      {
        id: "4",
        dependencySequence: 4,
        sequence: 4,
        status: "CHECKING",
        assignedEmployeeId: 4,
        subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
        assignedEmployee: { name: "Punch Designer" },
      },
      {
        id: "5",
        dependencySequence: 5,
        sequence: 5,
        status: "ASSIGNED",
        assignedEmployeeId: 8,
        subProcess: { name: "Machine Sample", code: "MACHINE_SAMPLE", isApproval: false },
        assignedEmployee: { name: "Machine Op" },
      },
    ];
    const tasks = [
      {
        id: BigInt(4),
        designId: BigInt(10),
        status: "CHECKING",
        dependencySequence: 4,
        sequence: 4,
        assignedEmployeeId: 4,
        priority: "HIGH",
        design: { id: BigInt(10), ideaRef: "IDEA-1", collectionName: "C" },
        subProcess: { name: "Punch", code: "PUNCH", isApproval: false },
      },
    ] as const;

    const enriched = enrichActionCenterHistoricalList([...tasks], new Map([["10", punchSiblings]]));
    expect(enriched[0].effectiveStatus).toBe("COMPLETED");
    expect(enriched[0].isWaitingOnOthers).toBe(true);
  });

  it("marks CHECKING sketch waiting on approval gate", () => {
    const withApproval: DepSibling[] = [
      ...siblings,
      {
        id: "3",
        dependencySequence: 3,
        sequence: 3,
        status: "ASSIGNED",
        assignedEmployeeId: 2,
        subProcess: { name: "Sketch Approval", code: "SKETCH_APPROVAL", isApproval: true },
        assignedEmployee: { name: "Design Head" },
      },
    ];
    const siblingsByDesignWithApproval = new Map([["10", withApproval]]);
    const tasks = [
      {
        id: BigInt(2),
        designId: BigInt(10),
        status: "CHECKING",
        dependencySequence: 2,
        sequence: 2,
        assignedEmployeeId: 5,
        priority: "URGENT",
        design: { id: BigInt(10), ideaRef: "IDEA-1", collectionName: "C" },
        subProcess: { name: "Sketch Creation", code: "SKETCH", isApproval: false },
      },
    ] as const;

    const enriched = enrichActionCenterHistoricalList([...tasks], siblingsByDesignWithApproval);
    expect(enriched[0].effectiveStatus).toBe("CHECKING");
    expect(enriched[0].isWaitingOnOthers).toBe(true);
    expect(enriched[0].waitingOnStage).toBe("Sketch Approval");
    expect(enriched[0].waitingOnAssignee).toBe("Design Head");
  });
});
