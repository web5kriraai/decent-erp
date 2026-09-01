import { describe, expect, it } from "vitest";
import { applyCreateReadiness, type TaskCreateRow } from "@/lib/services/task-generation-service";

function row(
  sequence: number,
  assignee?: number,
  dep?: number | null,
): TaskCreateRow {
  return {
    designId: BigInt(1),
    processId: 1,
    subProcessId: sequence,
    assignedRoleId: 1,
    assignedEmployeeId: assignee,
    expectedMinutes: 60,
    priority: "HIGH",
    sequence,
    dependencySequence: dep ?? null,
    status: "PENDING",
  };
}

describe("applyCreateReadiness", () => {
  it("ASSIGNED only for min sequence with assignee; later stages PENDING", () => {
    const tasks = [
      row(1, 2),
      row(2, 3),
      row(3, 2),
      row(7, 7),
    ];
    const ready = applyCreateReadiness(tasks);
    expect(ready[0].status).toBe("ASSIGNED");
    expect(ready[1].status).toBe("PENDING");
    expect(ready[2].status).toBe("PENDING");
    expect(ready[3].status).toBe("PENDING");
  });

  it("keeps all PENDING when first stage has no assignee", () => {
    const tasks = [row(1), row(2, 3)];
    const ready = applyCreateReadiness(tasks);
    expect(ready.every((t) => t.status === "PENDING")).toBe(true);
  });
});
