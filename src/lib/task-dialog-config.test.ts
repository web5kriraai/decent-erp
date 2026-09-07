import { describe, expect, it } from "vitest";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
  buildHandoffContextFromTask,
} from "@/lib/task-dialog-config";
import { ROLE_CODES } from "@/lib/permissions";
import { hasHandoffFacts } from "@/lib/handoff-context";
import {
  findPriorPeerForHandoff,
  priorSubProcessCodeForStage,
} from "@/lib/services/stage-approval-queue";

describe("task-dialog-config", () => {
  it("titles hold dialogs by stage and exposes hold kit fields", () => {
    const config = getTaskHoldDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SKETCH", name: "Sketch Creation" },
      design: { ideaRef: "IDEA-1" },
    });
    expect(config.title).toBe("Hold Sketch Creation");
    expect(config.description).toContain("IDEA-1");
    expect(config.remarkLabel).toMatch(/Hold/i);
    expect(config.nextStepHint).toMatch(/resumes/i);
  });

  it("uses sample-check specific end dialog", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SAMPLE_CHECK", name: "Sample Checking", isFileRequired: false },
    });
    expect(config.mode).toBe("sample_check");
    expect(config.showSampleOutcomes).toBe(true);
    expect(config.title).toMatch(/Sample Check/i);
    expect(config.nextStepHint).toMatch(/Costing/i);
  });

  it("marks costingEntry from capability (not only COSTING code)", () => {
    const textile = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "COSTING", name: "Costing" },
    });
    expect(textile.costingEntry).toBe(true);

    const custom = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: {
        code: "CUSTOM_COST",
        name: "Custom cost",
        capabilities: { costingEntry: true, forcesChecking: true },
      },
    });
    expect(custom.costingEntry).toBe(true);
  });

  it("forces checking for sketch end with stage-specific remark kit", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SKETCH", name: "Sketch Creation", isFileRequired: true },
    });
    expect(config.mode).toBe("execute_checking");
    expect(config.forceChecking).toBe(true);
    expect(config.showSampleOutcomes).toBe(false);
    expect(config.remarkLabel).toMatch(/Sketch/i);
    expect(config.nextStepHint).toMatch(/Sketch Approval/i);
  });

  it("forces checking and describes cost entry for COSTING end", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "COSTING", name: "Costing", isFileRequired: false },
      design: { ideaRef: "IDEA-9" },
    });
    expect(config.mode).toBe("execute_checking");
    expect(config.forceChecking).toBe(true);
    expect(config.showStatusSelect).toBe(false);
    expect(config.description).toMatch(/development costs/i);
    expect(config.description).toContain("IDEA-9");
    expect(config.priorContextSlots).toContain("sample");
  });

  it("routes approval stages away from generic execute end", () => {
    const config = getTaskEndDialogConfig(
      {
        status: "ASSIGNED",
        subProcess: { code: "SKETCH_APPROVAL", name: "Sketch Approval", isApproval: true },
      },
      ROLE_CODES.DESIGN_HEAD,
    );
    expect(config.mode).toBe("stage_approval");
  });

  it("builds handoff context from task + kit", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "PUNCH", name: "Punching / Wilcom", isFileRequired: true },
      design: { ideaRef: "IDEA-2", collectionName: "Festive", productType: "SAREE" },
      assignedEmployee: { name: "Asha" },
    });
    const ctx = buildHandoffContextFromTask(
      {
        status: "RUNNING",
        subProcess: { code: "PUNCH", name: "Punching / Wilcom" },
        design: { ideaRef: "IDEA-2", collectionName: "Festive", productType: "SAREE" },
        assignedEmployee: { name: "Asha" },
      },
      {
        description: config.description,
        nextStepHint: config.nextStepHint,
      },
    );
    expect(hasHandoffFacts(ctx)).toBe(true);
    expect(ctx.ideaRef).toBe("IDEA-2");
    expect(ctx.nextStepHint).toMatch(/Punching Checking/i);
  });
});

describe("prior stage handoff helpers", () => {
  it("maps punch check prior to punch", () => {
    expect(priorSubProcessCodeForStage("PUNCH_CHECK")).toBe("PUNCH");
  });

  it("finds prior peer by stage map", () => {
    const peer = findPriorPeerForHandoff("COSTING", [
      {
        status: "COMPLETED",
        outputRemark: "Sample OK",
        subProcess: { code: "SAMPLE_CHECK", name: "Sample Checking" },
        assignedEmployee: { name: "Checker" },
      },
    ]);
    expect(peer?.outputRemark).toBe("Sample OK");
  });
});
