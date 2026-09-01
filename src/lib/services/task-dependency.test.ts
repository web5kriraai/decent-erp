import { describe, expect, it } from "vitest";
import {
  DEPENDENCY_SATISFIED_STATUSES,
  MY_TASKS_VISIBLE_STATUSES,
  effectiveDependencySequence,
  initialStatusForCreate,
  isDependencySatisfiedStatus,
  isTaskReady,
  minReadyDependencySequence,
} from "@/lib/services/task-dependency";

describe("task dependency readiness", () => {
  it("treats CHECKING as satisfied for unlocking later stages", () => {
    expect(DEPENDENCY_SATISFIED_STATUSES).toContain("CHECKING");
    expect(isDependencySatisfiedStatus("CHECKING")).toBe(true);
    expect(isDependencySatisfiedStatus("ASSIGNED")).toBe(false);
  });

  it("never lists PENDING on My Tasks visible statuses", () => {
    expect(MY_TASKS_VISIBLE_STATUSES).not.toContain("PENDING");
    expect(MY_TASKS_VISIBLE_STATUSES).toContain("ASSIGNED");
    expect(MY_TASKS_VISIBLE_STATUSES).toContain("RUNNING");
    expect(MY_TASKS_VISIBLE_STATUSES).toContain("CORRECTION_REQUIRED");
  });

  it("assigns only ready rows with an assignee at create time", () => {
    expect(initialStatusForCreate({ hasAssignee: true, isReady: true })).toBe("ASSIGNED");
    expect(initialStatusForCreate({ hasAssignee: true, isReady: false })).toBe("PENDING");
    expect(initialStatusForCreate({ hasAssignee: false, isReady: true })).toBe("PENDING");
  });

  it("marks Design Head seq1 ready but seq3/seq8 blocked until priors finish", () => {
    const siblings = [
      { id: "1", dependencySequence: null, sequence: 1, status: "ASSIGNED" },
      { id: "2", dependencySequence: null, sequence: 2, status: "PENDING" },
      { id: "3", dependencySequence: null, sequence: 3, status: "PENDING" },
      { id: "8", dependencySequence: null, sequence: 8, status: "PENDING" },
    ];
    expect(isTaskReady(siblings[0], siblings)).toBe(true);
    expect(isTaskReady(siblings[2], siblings)).toBe(false);
    expect(isTaskReady(siblings[3], siblings)).toBe(false);

    const afterConcept = [
      { ...siblings[0], status: "CHECKING" },
      siblings[1],
      siblings[2],
      siblings[3],
    ];
    expect(isTaskReady(afterConcept[1], afterConcept)).toBe(true);
    expect(isTaskReady(afterConcept[2], afterConcept)).toBe(false);
  });

  it("does not treat Costing as ready until Sample Check is satisfied", () => {
    const siblings = [
      { id: "1", dependencySequence: null, sequence: 1, status: "COMPLETED" },
      { id: "2", dependencySequence: null, sequence: 2, status: "COMPLETED" },
      { id: "3", dependencySequence: null, sequence: 3, status: "COMPLETED" },
      { id: "4", dependencySequence: null, sequence: 4, status: "COMPLETED" },
      { id: "5", dependencySequence: null, sequence: 5, status: "COMPLETED" },
      { id: "6", dependencySequence: null, sequence: 6, status: "ASSIGNED" },
      { id: "7", dependencySequence: null, sequence: 7, status: "PENDING" },
    ];
    expect(isTaskReady(siblings[6], siblings)).toBe(false);
    siblings[5] = { ...siblings[5], status: "CHECKING" };
    expect(isTaskReady(siblings[6], siblings)).toBe(true);
  });

  it("computes min ready dep seq across a create batch", () => {
    const batch = [
      { dependencySequence: null, sequence: 1 },
      { dependencySequence: null, sequence: 2 },
      { dependencySequence: 3, sequence: 99 },
    ];
    expect(minReadyDependencySequence(batch)).toBe(1);
    expect(effectiveDependencySequence(batch[2])).toBe(3);
  });
});
