import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import {
  designRequiresCosting,
  evaluateTransition,
  isCostingReadyForTransition,
} from "@/lib/workflow/transition-policies";

function task(
  code: string,
  status: string,
  caps?: { costingEntry?: boolean; isApproval?: boolean },
) {
  return {
    status,
    subProcess: {
      code,
      name: code,
      isApproval: caps?.isApproval ?? false,
      capabilities: caps?.costingEntry
        ? { costingEntry: true }
        : code === "COSTING"
          ? undefined // textile fallback supplies costingEntry
          : caps?.isApproval
            ? { isApproval: true }
            : undefined,
    },
  };
}

describe("designRequiresCosting", () => {
  it("is false for short Concept→Sketch patterns with no costing stage", () => {
    expect(
      designRequiresCosting([
        task("CONCEPT_REVIEW", "COMPLETED", { isApproval: true }),
        task("SKETCH", "COMPLETED"),
        task("SKETCH_APPROVAL", "COMPLETED", { isApproval: true }),
      ]),
    ).toBe(false);
  });

  it("is true when COSTING (textile costingEntry) is present and active", () => {
    expect(
      designRequiresCosting([
        task("SAMPLE_CHECK", "COMPLETED", { isApproval: true }),
        task("COSTING", "CHECKING"),
        task("FINAL_APPROVAL", "ASSIGNED", { isApproval: true }),
      ]),
    ).toBe(true);
  });

  it("is true for explicit costingEntry capability without COSTING code", () => {
    expect(
      designRequiresCosting([
        task("CUSTOM_COST", "ASSIGNED", { costingEntry: true }),
      ]),
    ).toBe(true);
  });

  it("is false when costing stage is SKIPPED or CANCELLED", () => {
    expect(
      designRequiresCosting([
        task("COSTING", "SKIPPED"),
        task("FINAL_APPROVAL", "COMPLETED", { isApproval: true }),
      ]),
    ).toBe(false);
    expect(designRequiresCosting([task("COSTING", "CANCELLED")])).toBe(false);
  });
});

describe("isCostingReadyForTransition", () => {
  it("is ready when costing is not required", () => {
    expect(isCostingReadyForTransition(false, false)).toBe(true);
  });

  it("requires hasCosting when required", () => {
    expect(isCostingReadyForTransition(true, false)).toBe(false);
    expect(isCostingReadyForTransition(true, true)).toBe(true);
  });
});

describe("evaluateTransition", () => {
  const shortTasks = [
    task("CONCEPT_REVIEW", "COMPLETED", { isApproval: true }),
    task("SKETCH", "COMPLETED"),
    task("SKETCH_APPROVAL", "COMPLETED", { isApproval: true }),
  ];

  const costingTasks = [
    task("COSTING", "COMPLETED"),
    task("FINAL_APPROVAL", "COMPLETED", { isApproval: true }),
  ];

  it("sign_off allows short pattern without costing data", () => {
    const result = evaluateTransition({
      transition: "design.sign_off",
      tasks: shortTasks,
      hasCosting: false,
      stagesComplete: true,
    });
    expect(result.ok).toBe(true);
    expect(result.meta.requiresCosting).toBe(false);
    expect(result.blockers).toEqual([]);
  });

  it("sign_off blocks when costing stage present and no cost entries", () => {
    const result = evaluateTransition({
      transition: "design.sign_off",
      tasks: costingTasks,
      hasCosting: false,
      stagesComplete: true,
    });
    expect(result.ok).toBe(false);
    expect(result.meta.requiresCosting).toBe(true);
    expect(result.blockers[0]?.code).toBe(APP_ERROR_CODES.COSTING_REQUIRED);
  });

  it("sign_off passes when costing stage present and has cost entries", () => {
    const result = evaluateTransition({
      transition: "design.sign_off",
      tasks: costingTasks,
      hasCosting: true,
      stagesComplete: true,
    });
    expect(result.ok).toBe(true);
  });

  it("sign_off reports stages incomplete", () => {
    const result = evaluateTransition({
      transition: "design.sign_off",
      tasks: shortTasks,
      hasCosting: false,
      stagesComplete: false,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]?.code).toBe(APP_ERROR_CODES.WORKFLOW_NOT_READY);
  });

  it("production_release costing follows same presence rule", () => {
    const short = evaluateTransition({
      transition: "design.production_release",
      tasks: shortTasks,
      hasCosting: false,
    });
    expect(short.meta.requiresCosting).toBe(false);
    expect(short.ok).toBe(true);

    const full = evaluateTransition({
      transition: "design.production_release",
      tasks: costingTasks,
      hasCosting: false,
    });
    expect(full.ok).toBe(false);
    expect(full.blockers[0]?.code).toBe(APP_ERROR_CODES.COSTING_REQUIRED);
  });

  it("SKIPPED costing does not block sign_off", () => {
    const result = evaluateTransition({
      transition: "design.sign_off",
      tasks: [task("COSTING", "SKIPPED"), task("SKETCH_APPROVAL", "COMPLETED", { isApproval: true })],
      hasCosting: false,
      stagesComplete: true,
    });
    expect(result.ok).toBe(true);
    expect(result.meta.requiresCosting).toBe(false);
  });
});
