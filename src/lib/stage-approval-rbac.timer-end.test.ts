import { describe, expect, it } from "vitest";
import { usesStageApprovalActionsNotTimerEnd } from "@/lib/stage-approval-rbac";

describe("usesStageApprovalActionsNotTimerEnd", () => {
  it("blocks End for inline and task_panel approvals", () => {
    expect(usesStageApprovalActionsNotTimerEnd("SKETCH_APPROVAL")).toBe(true);
    expect(usesStageApprovalActionsNotTimerEnd("FINAL_APPROVAL")).toBe(true);
    expect(usesStageApprovalActionsNotTimerEnd("PUNCH_CHECK")).toBe(true);
    expect(usesStageApprovalActionsNotTimerEnd("LIVE_REVIEW")).toBe(true);
    expect(usesStageApprovalActionsNotTimerEnd("CONCEPT_REVIEW")).toBe(true);
  });

  it("allows End for SAMPLE_CHECK (task_end_dialog) and execute stages", () => {
    expect(usesStageApprovalActionsNotTimerEnd("SAMPLE_CHECK")).toBe(false);
    expect(usesStageApprovalActionsNotTimerEnd("SKETCH")).toBe(false);
    expect(usesStageApprovalActionsNotTimerEnd("COSTING")).toBe(false);
    expect(usesStageApprovalActionsNotTimerEnd("PROD_RELEASE")).toBe(false);
  });

  it("respects custom capabilities when code is unknown", () => {
    expect(
      usesStageApprovalActionsNotTimerEnd("CAD_REVIEW", {
        isApproval: true,
        capabilities: {
          isApproval: true,
          approvalSurface: "inline_card",
          approvalActions: ["approve"],
        },
      }),
    ).toBe(true);
    expect(
      usesStageApprovalActionsNotTimerEnd("CAD_CHECK", {
        capabilities: {
          isApproval: true,
          approvalSurface: "task_end_dialog",
          approvalActions: ["approve"],
        },
      }),
    ).toBe(false);
  });
});
