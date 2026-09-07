import { describe, expect, it } from "vitest";
import { collectPresentStageGaps } from "@/lib/services/production-release-readiness-utils";
import { evaluateTransition } from "@/lib/workflow/transition-policies";

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

  it("does not invent handoff/instruction gaps when ladder was never on the design", () => {
    const missing = collectPresentStageGaps({
      FINAL_APPROVAL: { status: "COMPLETED" },
    });
    expect(missing).not.toContain("Production handoff from Design Head");
    expect(missing).not.toContain("Production instruction");
    expect(missing).toEqual([]);
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

  it("passes short Concept→Sketch pattern with no production ladder", () => {
    const missing = collectPresentStageGaps({
      CONCEPT_REVIEW: { status: "COMPLETED", isApproval: true },
      SKETCH: { status: "CHECKING", isFileRequired: true, hasFile: true },
      SKETCH_APPROVAL: { status: "COMPLETED", isApproval: true },
    });
    expect(missing).toEqual([]);
  });

  it("flags incomplete present work stages and missing required files", () => {
    const missing = collectPresentStageGaps({
      SKETCH: { status: "ASSIGNED", isFileRequired: true, hasFile: false },
      SKETCH_APPROVAL: { status: "PENDING", isApproval: true },
    });
    expect(missing).toContain("Sketch work");
    expect(missing).toContain("Sketch approval");
  });
});

describe("evaluateTransition costing matrix (release callers)", () => {
  it("short / full / SKIPPED align with production_release costing gate", () => {
    const short = evaluateTransition({
      transition: "design.production_release",
      tasks: [
        {
          status: "COMPLETED",
          subProcess: { code: "SKETCH_APPROVAL", isApproval: true },
        },
      ],
      hasCosting: false,
    });
    expect(short.ok).toBe(true);
    expect(short.meta.requiresCosting).toBe(false);

    const full = evaluateTransition({
      transition: "design.production_release",
      tasks: [
        { status: "COMPLETED", subProcess: { code: "COSTING" } },
        {
          status: "COMPLETED",
          subProcess: { code: "FINAL_APPROVAL", isApproval: true },
        },
      ],
      hasCosting: false,
    });
    expect(full.ok).toBe(false);
    expect(full.meta.requiresCosting).toBe(true);

    const skipped = evaluateTransition({
      transition: "design.production_release",
      tasks: [
        { status: "SKIPPED", subProcess: { code: "COSTING" } },
        {
          status: "COMPLETED",
          subProcess: { code: "FINAL_APPROVAL", isApproval: true },
        },
      ],
      hasCosting: false,
    });
    expect(skipped.ok).toBe(true);
    expect(skipped.meta.requiresCosting).toBe(false);
  });
});
