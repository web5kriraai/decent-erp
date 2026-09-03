import { describe, expect, it } from "vitest";
import { ROLE_CODES } from "@/lib/permissions";
import { canRoleSeeStageApproval } from "@/lib/stage-approval-rbac";
import { isStageApprovalVisibleToViewer } from "@/lib/services/stage-approval-queue";

describe("stage approval visibility (owner oversee)", () => {
  it("lets Design Head see SKETCH_APPROVAL assigned to someone else", () => {
    expect(
      canRoleSeeStageApproval(ROLE_CODES.DESIGN_HEAD, "SKETCH_APPROVAL", {
        isAssignee: false,
        isUnassigned: false,
      }),
    ).toBe(true);
    expect(
      isStageApprovalVisibleToViewer({
        roleCode: ROLE_CODES.DESIGN_HEAD,
        approvalCode: "SKETCH_APPROVAL",
        assignedEmployeeId: 99,
        viewerEmployeeId: 1,
      }),
    ).toBe(true);
  });

  it("lets Admin see any stage code regardless of assignee", () => {
    expect(
      isStageApprovalVisibleToViewer({
        roleCode: ROLE_CODES.ADMIN,
        approvalCode: "LIVE_REVIEW",
        assignedEmployeeId: 42,
        viewerEmployeeId: 1,
      }),
    ).toBe(true);
  });

  it("lets Management see LIVE_REVIEW assigned to another employee", () => {
    expect(
      isStageApprovalVisibleToViewer({
        roleCode: ROLE_CODES.MANAGEMENT,
        approvalCode: "LIVE_REVIEW",
        assignedEmployeeId: 7,
        viewerEmployeeId: 3,
      }),
    ).toBe(true);
  });

  it("hides Design Head owned stages from Sample Checker unless assignee", () => {
    expect(
      isStageApprovalVisibleToViewer({
        roleCode: ROLE_CODES.SAMPLE_CHECKER,
        approvalCode: "SKETCH_APPROVAL",
        assignedEmployeeId: 99,
        viewerEmployeeId: 5,
      }),
    ).toBe(false);
    expect(
      isStageApprovalVisibleToViewer({
        roleCode: ROLE_CODES.SAMPLE_CHECKER,
        approvalCode: "SKETCH_APPROVAL",
        assignedEmployeeId: 5,
        viewerEmployeeId: 5,
      }),
    ).toBe(true);
  });

  it("shows unassigned items to viewers without an owner role (legacy personal queue)", () => {
    expect(
      canRoleSeeStageApproval(undefined, "PUNCH_CHECK", {
        isAssignee: false,
        isUnassigned: true,
      }),
    ).toBe(true);
  });
});
