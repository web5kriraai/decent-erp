import { describe, expect, it } from "vitest";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
} from "@/lib/task-dialog-config";
import { ROLE_CODES } from "@/lib/permissions";

describe("task-dialog-config", () => {
  it("titles hold dialogs by stage", () => {
    const config = getTaskHoldDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SKETCH", name: "Sketch Creation" },
      design: { ideaRef: "IDEA-1" },
    });
    expect(config.title).toBe("Hold Sketch Creation");
    expect(config.description).toContain("IDEA-1");
  });

  it("uses sample-check specific end dialog", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SAMPLE_CHECK", name: "Sample Checking", isFileRequired: false },
    });
    expect(config.mode).toBe("sample_check");
    expect(config.showSampleOutcomes).toBe(true);
    expect(config.title).toMatch(/Sample Check/i);
  });

  it("forces checking for sketch end", () => {
    const config = getTaskEndDialogConfig({
      status: "RUNNING",
      subProcess: { code: "SKETCH", name: "Sketch Creation", isFileRequired: true },
    });
    expect(config.mode).toBe("execute_checking");
    expect(config.forceChecking).toBe(true);
    expect(config.showSampleOutcomes).toBe(false);
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
});
