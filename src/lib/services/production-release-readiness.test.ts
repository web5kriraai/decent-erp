import { describe, expect, it } from "vitest";
import { collectPresentStageGaps } from "@/lib/services/production-release-readiness-utils";

describe("collectPresentStageGaps (pattern-aware readiness)", () => {
  it("does not require Punch when the pattern omitted PUNCH", () => {
    const missing = collectPresentStageGaps({
      SKETCH: { status: "CHECKING" },
      SKETCH_APPROVAL: { status: "COMPLETED" },
      MACHINE_SAMPLE: { status: "CHECKING" },
      SAMPLE_CHECK: { status: "COMPLETED" },
      FINAL_APPROVAL: { status: "COMPLETED" },
      PROD_HANDOFF: { status: "COMPLETED" },
      PROD_INSTRUCTION: { status: "COMPLETED" },
    });
    expect(missing).not.toContain("Punching / Wilcom work");
    expect(missing).toEqual([]);
  });

  it("requires handoff and instruction when ladder is present but incomplete", () => {
    const missing = collectPresentStageGaps({
      FINAL_APPROVAL: { status: "COMPLETED" },
      PROD_HANDOFF: { status: "ASSIGNED" },
      PROD_INSTRUCTION: { status: "PENDING" },
    });
    expect(missing).toContain("Production handoff from Design Head");
    expect(missing).toContain("Production instruction");
  });

  it("fails when production ladder was never appended", () => {
    const missing = collectPresentStageGaps({
      FINAL_APPROVAL: { status: "COMPLETED" },
    });
    expect(missing).toContain("Production handoff from Design Head");
    expect(missing).toContain("Production instruction");
  });

  it("passes Spec 8-Step style snapshot after handoff and instruction complete", () => {
    const missing = collectPresentStageGaps({
      SKETCH: { status: "CHECKING", isFileRequired: true, hasFile: true },
      SKETCH_APPROVAL: { status: "COMPLETED" },
      PUNCH: { status: "CHECKING", isFileRequired: true, hasFile: true },
      MACHINE_SAMPLE: { status: "CHECKING" },
      SAMPLE_CHECK: { status: "COMPLETED" },
      FINAL_APPROVAL: { status: "COMPLETED" },
      PROD_HANDOFF: { status: "COMPLETED" },
      PROD_INSTRUCTION: { status: "COMPLETED" },
    });
    expect(missing).toEqual([]);
  });
});
