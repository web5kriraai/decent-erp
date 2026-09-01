import { describe, expect, it } from "vitest";
import {
  countTerminalPhases,
  isDesignClosedForOverride,
  isDesignWorkflowComplete,
  isQcCheckTask,
  isTerminalTaskStatus,
} from "@/lib/services/workflow-override-utils";

describe("workflow override utils", () => {
  it("identifies QC/check/approval tasks", () => {
    expect(isQcCheckTask({ code: "PUNCH_CHECK" })).toBe(true);
    expect(isQcCheckTask({ code: "SAMPLE_CHECK" })).toBe(true);
    expect(isQcCheckTask({ code: "FINAL_APPROVAL", isApproval: true })).toBe(true);
    expect(isQcCheckTask({ code: "SKETCH" })).toBe(false);
    expect(isQcCheckTask({ code: "COSTING" })).toBe(false);
  });

  it("treats SKIPPED as terminal for workflow completion", () => {
    expect(isTerminalTaskStatus("SKIPPED")).toBe(true);
    expect(
      isDesignWorkflowComplete([
        { status: "COMPLETED" },
        { status: "SKIPPED" },
        { status: "CANCELLED" },
      ]),
    ).toBe(true);
    expect(
      isDesignWorkflowComplete([
        { status: "COMPLETED" },
        { status: "ASSIGNED" },
      ]),
    ).toBe(false);
  });

  it("counts skipped phases separately from completed work", () => {
    const counts = countTerminalPhases([
      { status: "COMPLETED" },
      { status: "COMPLETED" },
      { status: "SKIPPED" },
      { status: "PENDING" },
    ]);
    expect(counts.completed).toBe(2);
    expect(counts.skipped).toBe(1);
    expect(counts.total).toBe(4);
  });

  it("blocks override on closed designs", () => {
    expect(isDesignClosedForOverride("LIVE")).toBe(true);
    expect(isDesignClosedForOverride("ACTIVE")).toBe(false);
  });
});
