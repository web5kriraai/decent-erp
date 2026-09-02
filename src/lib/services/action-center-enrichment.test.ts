import { describe, expect, it } from "vitest";
import { enrichActionCenterTaskList } from "@/lib/services/action-center-enrichment";
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
});
