import { describe, expect, it, vi } from "vitest";
import { demoteBlockedAssignedTaskInTx } from "@/lib/services/task-readiness";

describe("demoteBlockedAssignedTaskInTx", () => {
  it("demotes ASSIGNED Costing when Sample Checking is still incomplete", async () => {
    const update = vi.fn().mockResolvedValue({
      id: 7n,
      status: "PENDING",
    });
    const tx = {
      designTask: { update },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    } as never;

    const task = {
      id: 7n,
      designId: 1n,
      dependencySequence: null,
      sequence: 7,
      status: "ASSIGNED",
      assignedEmployeeId: 99,
    };

    const siblings = [
      { id: 5n, dependencySequence: null, sequence: 5, status: "CHECKING" },
      { id: 6n, dependencySequence: null, sequence: 6, status: "CORRECTION_REQUIRED" },
      { id: 7n, dependencySequence: null, sequence: 7, status: "ASSIGNED" },
    ];

    const result = await demoteBlockedAssignedTaskInTx(tx, task, siblings, 99, "test-corr");
    expect(result.status).toBe("PENDING");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7n },
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("leaves ASSIGNED Costing alone when priors are satisfied", async () => {
    const update = vi.fn();
    const tx = {
      designTask: { update },
    } as never;

    const task = {
      id: 7n,
      designId: 1n,
      dependencySequence: null,
      sequence: 7,
      status: "ASSIGNED",
      assignedEmployeeId: 99,
    };

    const siblings = [
      { id: 5n, dependencySequence: null, sequence: 5, status: "CHECKING" },
      { id: 6n, dependencySequence: null, sequence: 6, status: "COMPLETED" },
      { id: 7n, dependencySequence: null, sequence: 7, status: "ASSIGNED" },
    ];

    const result = await demoteBlockedAssignedTaskInTx(tx, task, siblings, 99, "test-corr");
    expect(result.status).toBe("ASSIGNED");
    expect(update).not.toHaveBeenCalled();
  });
});
