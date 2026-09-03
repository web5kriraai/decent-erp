import { describe, expect, it } from "vitest";
import {
  canRoleActOnManagementLevel,
  canRoleSeeManagementSignOff,
  canRoleSeeReadyForSignOff,
  getManagementLevelOwnerRole,
} from "@/lib/approval-hub-rbac";
import { ROLE_CODES } from "@/lib/permissions";
import {
  canRoleAccessApprovalsHub,
  canRoleActOnStageApproval,
  canRoleSeeStageApproval,
  filterStageApprovalsForRole,
  getApprovalHubTabsForRole,
  getStageApprovalOwnerRole,
  isInlineStageApprovalSurface,
} from "@/lib/stage-approval-rbac";

describe("stage-approval-rbac", () => {
  it("maps LIVE_REVIEW to Management and allows Admin override", () => {
    expect(getStageApprovalOwnerRole("LIVE_REVIEW")).toBe(ROLE_CODES.MANAGEMENT);
    expect(canRoleActOnStageApproval(ROLE_CODES.MANAGEMENT, "LIVE_REVIEW")).toBe(true);
    expect(canRoleActOnStageApproval(ROLE_CODES.ADMIN, "LIVE_REVIEW")).toBe(true);
    expect(canRoleActOnStageApproval(ROLE_CODES.PRODUCTION_HEAD, "LIVE_REVIEW")).toBe(false);
    expect(canRoleActOnStageApproval(ROLE_CODES.DESIGN_HEAD, "LIVE_REVIEW")).toBe(false);
  });

  it("maps stage owners from spec roles", () => {
    expect(getStageApprovalOwnerRole("SKETCH_APPROVAL")).toBe(ROLE_CODES.DESIGN_HEAD);
    expect(getStageApprovalOwnerRole("PUNCH_CHECK")).toBe(ROLE_CODES.SAMPLE_CHECKER);
    expect(getStageApprovalOwnerRole("SAMPLE_CHECK")).toBe(ROLE_CODES.SAMPLE_CHECKER);
  });

  it("allows only owner roles to act on stage approvals", () => {
    expect(canRoleActOnStageApproval(ROLE_CODES.DESIGN_HEAD, "SKETCH_APPROVAL")).toBe(true);
    expect(canRoleActOnStageApproval(ROLE_CODES.SAMPLE_CHECKER, "SKETCH_APPROVAL")).toBe(false);
    expect(canRoleActOnStageApproval(ROLE_CODES.SAMPLE_CHECKER, "PUNCH_CHECK")).toBe(true);
    expect(canRoleActOnStageApproval(ROLE_CODES.DESIGN_HEAD, "PUNCH_CHECK")).toBe(false);
  });

  it("uses inline card only for design-head stage approvals", () => {
    expect(isInlineStageApprovalSurface("SKETCH_APPROVAL")).toBe(true);
    expect(isInlineStageApprovalSurface("PUNCH_CHECK")).toBe(false);
    expect(isInlineStageApprovalSurface("SAMPLE_CHECK")).toBe(false);
  });

  it("filters stage queue items by role", () => {
    const items = [
      { stageCode: "SKETCH_APPROVAL", taskId: "1" },
      { stageCode: "PUNCH_CHECK", taskId: "2" },
      { stageCode: "SAMPLE_CHECK", taskId: "3" },
    ];
    expect(filterStageApprovalsForRole(ROLE_CODES.DESIGN_HEAD, items)).toHaveLength(1);
    expect(filterStageApprovalsForRole(ROLE_CODES.SAMPLE_CHECKER, items)).toHaveLength(2);
  });

  it("lets owner roles see stage approvals assigned to others", () => {
    expect(
      canRoleSeeStageApproval(ROLE_CODES.DESIGN_HEAD, "FINAL_APPROVAL", {
        isAssignee: false,
        isUnassigned: false,
      }),
    ).toBe(true);
    expect(
      canRoleSeeStageApproval(ROLE_CODES.ADMIN, "PUNCH_CHECK", {
        isAssignee: false,
        isUnassigned: false,
      }),
    ).toBe(true);
    expect(
      canRoleSeeStageApproval(ROLE_CODES.PRODUCTION_HEAD, "LIVE_REVIEW", {
        isAssignee: false,
        isUnassigned: true,
      }),
    ).toBe(true);
    expect(
      canRoleSeeStageApproval(ROLE_CODES.PRODUCTION_HEAD, "LIVE_REVIEW", {
        isAssignee: false,
        isUnassigned: false,
      }),
    ).toBe(false);
  });

  it("exposes hub tabs per role", () => {
    expect(getApprovalHubTabsForRole(ROLE_CODES.DESIGN_HEAD)).toEqual({
      stage: true,
      ready: true,
      management: true,
    });
    expect(getApprovalHubTabsForRole(ROLE_CODES.SAMPLE_CHECKER)).toEqual({
      stage: true,
      ready: false,
      management: true,
    });
    expect(getApprovalHubTabsForRole(ROLE_CODES.PUNCHING_DESIGNER)).toEqual({
      stage: false,
      ready: false,
      management: false,
    });
    expect(canRoleAccessApprovalsHub(ROLE_CODES.PUNCHING_DESIGNER)).toBe(false);
    expect(getApprovalHubTabsForRole(ROLE_CODES.ADMIN)).toEqual({
      stage: true,
      ready: false,
      management: true,
    });
    expect(canRoleAccessApprovalsHub(ROLE_CODES.ADMIN)).toBe(true);
    expect(canRoleSeeReadyForSignOff(ROLE_CODES.ADMIN)).toBe(false);
  });
});

describe("approval-hub-rbac", () => {
  it("maps management chain owners", () => {
    expect(getManagementLevelOwnerRole("CHECKER_APPROVAL")).toBe(ROLE_CODES.SAMPLE_CHECKER);
    expect(getManagementLevelOwnerRole("DESIGN_HEAD_APPROVAL")).toBe(ROLE_CODES.DESIGN_HEAD);
    expect(getManagementLevelOwnerRole("MANAGEMENT_APPROVAL")).toBe(ROLE_CODES.MANAGEMENT);
  });

  it("restricts management level actions by role", () => {
    expect(canRoleActOnManagementLevel(ROLE_CODES.SAMPLE_CHECKER, "CHECKER_APPROVAL")).toBe(true);
    expect(canRoleActOnManagementLevel(ROLE_CODES.MANAGEMENT, "CHECKER_APPROVAL")).toBe(false);
    expect(canRoleActOnManagementLevel(ROLE_CODES.ADMIN, "CHECKER_APPROVAL")).toBe(true);
    expect(canRoleActOnManagementLevel(ROLE_CODES.ADMIN, "MANAGEMENT_APPROVAL")).toBe(true);
    expect(canRoleSeeReadyForSignOff(ROLE_CODES.DESIGN_HEAD)).toBe(true);
    expect(canRoleSeeReadyForSignOff(ROLE_CODES.MANAGEMENT)).toBe(false);
    expect(canRoleSeeManagementSignOff(ROLE_CODES.ADMIN)).toBe(true);
  });
});
