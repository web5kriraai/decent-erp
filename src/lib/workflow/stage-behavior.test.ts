import { describe, expect, it } from "vitest";
import { ROLE_CODES } from "@/lib/permissions";
import {
  STAGE_APPROVAL_CODES,
  STAGE_APPROVAL_OWNER_ROLE,
  STAGE_APPROVAL_UI,
  getStageApprovalUiConfig,
  isStageApprovalCode,
} from "@/lib/stage-approval-rbac";
import { WORK_CODE_BY_APPROVAL } from "@/lib/services/stage-approval-queue";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";
import { PRODUCTION_POST_APPROVAL_CODES } from "@/lib/services/production-workflow";
import {
  resolveStageBehavior,
  isStageApprovalActionableFromBehavior,
} from "@/lib/workflow/stage-behavior";
import { TEXTILE_CAPABILITIES_BY_CODE } from "@/lib/workflow/stage-capabilities";
import { isStageApprovalActionable } from "@/lib/design-workflow";

describe("resolveStageBehavior textile parity", () => {
  it("covers every seeded textile code", () => {
    const expected = [
      "CONCEPT_REVIEW",
      "SKETCH",
      "SKETCH_APPROVAL",
      "PUNCH",
      "PUNCH_CHECK",
      "CORRECTION",
      "MAT_REQ",
      "FABRIC_ISSUE",
      "MACHINE_SAMPLE",
      "SAMPLE_RECEIVE",
      "SAMPLE_CHECK",
      "RESAMPLE",
      "COSTING",
      "FINAL_APPROVAL",
      "PROD_HANDOFF",
      "PROD_INSTRUCTION",
      "PROD_RELEASE",
      "LIVE_REVIEW",
    ];
    for (const code of expected) {
      expect(TEXTILE_CAPABILITIES_BY_CODE[code], code).toBeTruthy();
    }
  });

  it("matches STAGE_APPROVAL_CODES membership and surfaces", () => {
    for (const code of STAGE_APPROVAL_CODES) {
      const behavior = resolveStageBehavior({ code });
      expect(behavior.isApproval).toBe(true);
      expect(isStageApprovalCode(code)).toBe(true);
      const legacy = getStageApprovalUiConfig(code)!;
      expect(behavior.approvalSurface).toBe(legacy.surface);
      expect(behavior.approvalActions).toEqual(legacy.actions);
      expect(behavior.showCompare).toBe(legacy.showCompare);
      expect(behavior.showGallery).toBe(legacy.showGallery);
      expect(behavior.showChecklist).toBe(legacy.showChecklist);
    }
  });

  it("matches WORK_CODE_BY_APPROVAL precursors", () => {
    for (const [approval, work] of Object.entries(WORK_CODE_BY_APPROVAL)) {
      if (approval === "CONCEPT_REVIEW") {
        // CONCEPT has no work precursor in capabilities (always actionable).
        expect(resolveStageBehavior({ code: approval }).workPrecursorCode).toBeNull();
        continue;
      }
      expect(resolveStageBehavior({ code: approval }).workPrecursorCode).toBe(work);
    }
  });

  it("matches textile owner roles when defaultRole omitted", () => {
    for (const code of STAGE_APPROVAL_CODES) {
      expect(STAGE_APPROVAL_OWNER_ROLE[code]).toBeTruthy();
      expect(STAGE_APPROVAL_UI[code]).toBeTruthy();
    }
    expect(STAGE_APPROVAL_OWNER_ROLE.CONCEPT_REVIEW).toBe(ROLE_CODES.DESIGN_HEAD);
    expect(STAGE_APPROVAL_OWNER_ROLE.LIVE_REVIEW).toBe(ROLE_CODES.MANAGEMENT);
  });

  it("matches machine output detection", () => {
    for (const code of Object.keys(TEXTILE_CAPABILITIES_BY_CODE)) {
      expect(resolveStageBehavior({ code }).machineOutput).toBe(isMachineOutputTask(code));
    }
  });

  it("marks production ladder unlockAfterDesignApproved", () => {
    for (const code of PRODUCTION_POST_APPROVAL_CODES) {
      expect(resolveStageBehavior({ code }).unlockAfterDesignApproved).toBe(true);
    }
  });

  it("keeps textile inline_card when DB isApproval flag is passed", () => {
    expect(
      resolveStageBehavior({ code: "SKETCH_APPROVAL", isApproval: true }).approvalSurface,
    ).toBe("inline_card");
    expect(
      resolveStageBehavior({ code: "FINAL_APPROVAL", isApproval: true }).approvalSurface,
    ).toBe("inline_card");
    expect(
      resolveStageBehavior({ code: "PUNCH_CHECK", isApproval: true }).approvalSurface,
    ).toBe("task_panel");
  });

  it("defaults custom approval stages without surface to task_panel", () => {
    expect(
      resolveStageBehavior({ code: "CUSTOM_GATE", isApproval: true }).approvalSurface,
    ).toBe("task_panel");
  });

  it("matches isStageApprovalActionable gate rules", () => {
    const cases: Array<{
      code: string;
      work?: { status: string };
      expected: boolean;
    }> = [
      { code: "CONCEPT_REVIEW", expected: true },
      { code: "SKETCH_APPROVAL", work: { status: "CHECKING" }, expected: true },
      { code: "SKETCH_APPROVAL", work: { status: "COMPLETED" }, expected: true },
      { code: "SKETCH_APPROVAL", work: { status: "RUNNING" }, expected: false },
      { code: "PUNCH_CHECK", work: { status: "CHECKING" }, expected: true },
      { code: "PUNCH_CHECK", work: { status: "COMPLETED" }, expected: true },
      { code: "FINAL_APPROVAL", work: { status: "COMPLETED" }, expected: true },
      { code: "FINAL_APPROVAL", work: { status: "CHECKING" }, expected: true },
      { code: "LIVE_REVIEW", work: { status: "COMPLETED" }, expected: true },
      { code: "SAMPLE_CHECK", work: { status: "CHECKING" }, expected: true },
      { code: "SAMPLE_CHECK", work: { status: "COMPLETED" }, expected: false },
    ];
    for (const c of cases) {
      const behavior = resolveStageBehavior({ code: c.code });
      expect(isStageApprovalActionableFromBehavior(behavior, c.work)).toBe(c.expected);
      expect(isStageApprovalActionable(c.code, c.work)).toBe(c.expected);
    }
  });

  it("derives end dialog modes for key stages", () => {
    expect(resolveStageBehavior({ code: "SAMPLE_CHECK" }).endDialogMode).toBe("sample_check");
    expect(resolveStageBehavior({ code: "SKETCH_APPROVAL" }).endDialogMode).toBe(
      "stage_approval",
    );
    expect(resolveStageBehavior({ code: "MACHINE_SAMPLE" }).endDialogMode).toBe("machine");
    expect(resolveStageBehavior({ code: "COSTING" }).endDialogMode).toBe("execute_checking");
    expect(resolveStageBehavior({ code: "PROD_RELEASE" }).endDialogMode).toBe(
      "execute_complete",
    );
    expect(resolveStageBehavior({ code: "SKETCH" }).endDialogMode).toBe("execute_checking");
  });

  it("allows custom unknown codes via column flags + capabilities blob", () => {
    const behavior = resolveStageBehavior({
      code: "CAD_REVIEW",
      name: "CAD Review",
      isApproval: true,
      capabilities: {
        isApproval: true,
        approvalSurface: "inline_card",
        approvalActions: ["approve", "correction"],
        workPrecursor: { bySubProcessCode: "CAD" },
        workGateMode: "checking",
      },
    });
    expect(behavior.isApproval).toBe(true);
    expect(behavior.approvalSurface).toBe("inline_card");
    expect(behavior.workPrecursorCode).toBe("CAD");
    expect(behavior.endDialogMode).toBe("stage_approval");
  });
});
