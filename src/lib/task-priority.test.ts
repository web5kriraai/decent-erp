import { describe, expect, it } from "vitest";
import {
  compareTasksByPriority,
  groupActionCenterTasks,
  resolveEffectiveTaskPriority,
  sortTasksByPriority,
} from "@/lib/task-priority";

describe("task-priority", () => {
  it("sorts URGENT before HIGH before MEDIUM before LOW", () => {
    const tasks = [
      { priority: "LOW", design: { ideaRef: "A" } },
      { priority: "URGENT", design: { ideaRef: "B" } },
      { priority: "MEDIUM", design: { ideaRef: "C" } },
      { priority: "HIGH", design: { ideaRef: "D" } },
    ];
    expect(sortTasksByPriority(tasks).map((t) => t.priority)).toEqual([
      "URGENT",
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
  });

  it("breaks ties by dueAt then ideaRef", () => {
    const a = { priority: "HIGH", dueAt: new Date("2026-01-02"), design: { ideaRef: "B" } };
    const b = { priority: "HIGH", dueAt: new Date("2026-01-01"), design: { ideaRef: "A" } };
    expect(compareTasksByPriority(a, b)).toBeGreaterThan(0);
  });

  it("groups ready PENDING with ASSIGNED in READY bucket", () => {
    const grouped = groupActionCenterTasks([
      { status: "ASSIGNED", priority: "MEDIUM", design: { ideaRef: "A" } },
      { status: "PENDING", priority: "HIGH", design: { ideaRef: "B" } },
      { status: "RUNNING", priority: "LOW", design: { ideaRef: "C" } },
    ]);
    expect(grouped.READY).toHaveLength(2);
    expect(grouped.READY[0].status).toBe("PENDING");
    expect(grouped.RUNNING).toHaveLength(1);
  });

  it("resolveEffectiveTaskPriority uses design URGENT over task HIGH", () => {
    expect(resolveEffectiveTaskPriority("HIGH", "URGENT")).toBe("URGENT");
    expect(resolveEffectiveTaskPriority("URGENT", "MEDIUM")).toBe("URGENT");
    expect(resolveEffectiveTaskPriority("LOW", "MEDIUM")).toBe("MEDIUM");
  });
});
