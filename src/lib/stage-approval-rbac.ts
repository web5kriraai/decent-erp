import { ROLE_CODES } from "@/lib/permissions";

/** Workflow stage approval sub-process codes (Layer 1). */
export const STAGE_APPROVAL_CODES = [
  "CONCEPT_REVIEW",
  "SKETCH_APPROVAL",
  "PUNCH_CHECK",
  "SAMPLE_CHECK",
  "FINAL_APPROVAL",
] as const;

export type StageApprovalCode = (typeof STAGE_APPROVAL_CODES)[number];

export type StageApprovalAction = "approve" | "correction" | "reject" | "resample";

export type StageApprovalSurface = "inline_card" | "task_panel" | "task_end_dialog";

export type StageApprovalUiConfig = {
  surface: StageApprovalSurface;
  actions: StageApprovalAction[];
  showCompare: boolean;
  showGallery: boolean;
  showChecklist: boolean;
  title?: string;
};

/** Role that owns each workflow stage approval (from masters-data.ts). */
export const STAGE_APPROVAL_OWNER_ROLE: Record<StageApprovalCode, string> = {
  CONCEPT_REVIEW: ROLE_CODES.DESIGN_HEAD,
  SKETCH_APPROVAL: ROLE_CODES.DESIGN_HEAD,
  PUNCH_CHECK: ROLE_CODES.SAMPLE_CHECKER,
  SAMPLE_CHECK: ROLE_CODES.SAMPLE_CHECKER,
  FINAL_APPROVAL: ROLE_CODES.DESIGN_HEAD,
};

export const STAGE_APPROVAL_UI: Record<StageApprovalCode, StageApprovalUiConfig> = {
  CONCEPT_REVIEW: {
    surface: "inline_card",
    actions: ["approve", "correction", "reject"],
    showCompare: false,
    showGallery: false,
    showChecklist: false,
    title: "Concept review — your action",
  },
  SKETCH_APPROVAL: {
    surface: "inline_card",
    actions: ["approve", "correction", "reject"],
    showCompare: true,
    showGallery: true,
    showChecklist: false,
    title: "Sketch ready for your approval",
  },
  PUNCH_CHECK: {
    surface: "task_panel",
    actions: ["approve", "correction", "reject"],
    showCompare: true,
    showGallery: false,
    showChecklist: false,
    title: "Punching check — review decision",
  },
  SAMPLE_CHECK: {
    surface: "task_end_dialog",
    actions: ["approve", "reject", "resample"],
    showCompare: false,
    showGallery: false,
    showChecklist: true,
    title: "Sample check decision",
  },
  FINAL_APPROVAL: {
    surface: "inline_card",
    actions: ["approve", "correction", "reject"],
    showCompare: false,
    showGallery: false,
    showChecklist: false,
    title: "Final approval — your action",
  },
};

export function isStageApprovalCode(code: string): code is StageApprovalCode {
  return (STAGE_APPROVAL_CODES as readonly string[]).includes(code);
}

export function getStageApprovalOwnerRole(code: string): string | null {
  if (!isStageApprovalCode(code)) return null;
  return STAGE_APPROVAL_OWNER_ROLE[code];
}

export function getStageApprovalUiConfig(code: string): StageApprovalUiConfig | null {
  if (!isStageApprovalCode(code)) return null;
  return STAGE_APPROVAL_UI[code];
}

export function isInlineStageApprovalSurface(code: string): boolean {
  const config = getStageApprovalUiConfig(code);
  return config?.surface === "inline_card";
}

export function canRoleActOnStageApproval(
  roleCode: string | null | undefined,
  approvalCode: string,
  options: { isAssignee?: boolean } = {},
): boolean {
  if (!roleCode) return false;
  const ownerRole = getStageApprovalOwnerRole(approvalCode);
  if (!ownerRole) return false;
  if (roleCode !== ownerRole) return false;
  if (options.isAssignee === false) {
    return true;
  }
  return true;
}

export function canRoleViewUnassignedStageApproval(
  roleCode: string | null | undefined,
  approvalCode: string,
): boolean {
  return canRoleActOnStageApproval(roleCode, approvalCode);
}

export type ApprovalHubTabs = {
  stage: boolean;
  ready: boolean;
  management: boolean;
};

/** Which Approvals hub tabs each role may see (strict role rules — no permission bypass). */
export function getApprovalHubTabsForRole(roleCode: string | null | undefined): ApprovalHubTabs {
  switch (roleCode) {
    case ROLE_CODES.DESIGN_HEAD:
      return { stage: true, ready: true, management: true };
    case ROLE_CODES.SAMPLE_CHECKER:
      return { stage: true, ready: false, management: true };
    case ROLE_CODES.MANAGEMENT:
      return { stage: false, ready: false, management: true };
    default:
      return { stage: false, ready: false, management: false };
  }
}

export function canRoleAccessApprovalsHub(roleCode: string | null | undefined): boolean {
  const tabs = getApprovalHubTabsForRole(roleCode);
  return tabs.stage || tabs.ready || tabs.management;
}

export function filterStageApprovalsForRole<T extends { stageCode: string }>(
  roleCode: string | null | undefined,
  items: T[],
): T[] {
  if (!roleCode) return [];
  return items.filter((item) => {
    const owner = getStageApprovalOwnerRole(item.stageCode);
    return owner === roleCode;
  });
}

export function stageCodesOwnedByRole(roleCode: string | null | undefined): StageApprovalCode[] {
  if (!roleCode) return [];
  return STAGE_APPROVAL_CODES.filter((code) => STAGE_APPROVAL_OWNER_ROLE[code] === roleCode);
}
