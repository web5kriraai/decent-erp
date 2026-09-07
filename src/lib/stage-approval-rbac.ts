import { ROLE_CODES } from "@/lib/permissions";
import {
  canRoleSeeReadyForSignOff,
} from "@/lib/approval-hub-rbac";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import {
  TEXTILE_APPROVAL_OWNER_ROLE,
  type StageApprovalAction,
  type StageApprovalSurface,
} from "@/lib/workflow/stage-capabilities";

/** @deprecated Prefer resolveStageBehavior — kept for textile parity / tests. */
export const STAGE_APPROVAL_CODES = [
  "CONCEPT_REVIEW",
  "SKETCH_APPROVAL",
  "PUNCH_CHECK",
  "SAMPLE_CHECK",
  "FINAL_APPROVAL",
  "LIVE_REVIEW",
] as const;

export type StageApprovalCode = (typeof STAGE_APPROVAL_CODES)[number];

export type { StageApprovalAction };
export type StageApprovalSurfaceUi = Exclude<StageApprovalSurface, "none">;

export type StageApprovalUiConfig = {
  surface: StageApprovalSurfaceUi;
  actions: StageApprovalAction[];
  showCompare: boolean;
  showGallery: boolean;
  showChecklist: boolean;
  title?: string;
};

/** @deprecated Prefer defaultRole on the sub-process master. */
export const STAGE_APPROVAL_OWNER_ROLE: Record<StageApprovalCode, string> = {
  CONCEPT_REVIEW: TEXTILE_APPROVAL_OWNER_ROLE.CONCEPT_REVIEW,
  SKETCH_APPROVAL: TEXTILE_APPROVAL_OWNER_ROLE.SKETCH_APPROVAL,
  PUNCH_CHECK: TEXTILE_APPROVAL_OWNER_ROLE.PUNCH_CHECK,
  SAMPLE_CHECK: TEXTILE_APPROVAL_OWNER_ROLE.SAMPLE_CHECK,
  FINAL_APPROVAL: TEXTILE_APPROVAL_OWNER_ROLE.FINAL_APPROVAL,
  LIVE_REVIEW: TEXTILE_APPROVAL_OWNER_ROLE.LIVE_REVIEW,
};

/** @deprecated Prefer resolveStageBehavior — textile UI snapshot for tests. */
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
    showGallery: true,
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
    title: "Final approval — costing & sample ready?",
  },
  LIVE_REVIEW: {
    surface: "task_panel",
    actions: ["approve"],
    showCompare: false,
    showGallery: false,
    showChecklist: false,
    title: "Live Design Review — go-live decision",
  },
};

export function isStageApprovalCode(code: string): boolean {
  const behavior = resolveStageBehavior({ code });
  return behavior.isApproval && behavior.approvalSurface !== "none";
}

export function getStageApprovalOwnerRole(
  code: string,
  ownerRoleCode?: string | null,
): string | null {
  if (ownerRoleCode) return ownerRoleCode;
  return TEXTILE_APPROVAL_OWNER_ROLE[code] ?? null;
}

export function getStageApprovalUiConfig(
  code: string,
  capabilities?: unknown,
  options?: { isApproval?: boolean },
): StageApprovalUiConfig | null {
  const behavior = resolveStageBehavior({
    code,
    capabilities,
    isApproval: options?.isApproval,
  });
  if (!behavior.isApproval || behavior.approvalSurface === "none") return null;
  return {
    surface: behavior.approvalSurface,
    actions: behavior.approvalActions,
    showCompare: behavior.showCompare,
    showGallery: behavior.showGallery,
    showChecklist: behavior.showChecklist,
    title: behavior.approvalTitle,
  };
}

/**
 * True when the stage must be completed via Approve / Correction / Reject
 * (inline card or task panel) — not the timer End dialog.
 * SAMPLE_CHECK (task_end_dialog) returns false so End remains allowed.
 */
export function usesStageApprovalActionsNotTimerEnd(
  code: string | null | undefined,
  options?: { capabilities?: unknown; isApproval?: boolean },
): boolean {
  if (!code) return false;
  const config = getStageApprovalUiConfig(code, options?.capabilities, {
    isApproval: options?.isApproval,
  });
  if (!config) return false;
  return config.surface !== "task_end_dialog";
}

export function isInlineStageApprovalSurface(code: string, capabilities?: unknown): boolean {
  const config = getStageApprovalUiConfig(code, capabilities);
  return config?.surface === "inline_card";
}

export function canRoleActOnStageApproval(
  roleCode: string | null | undefined,
  approvalCode: string,
  options: { isAssignee?: boolean; ownerRoleCode?: string | null; capabilities?: unknown } = {},
): boolean {
  if (!roleCode) return false;
  const behavior = resolveStageBehavior({
    code: approvalCode,
    capabilities: options.capabilities,
    defaultRoleCode: options.ownerRoleCode,
  });
  if (!behavior.isApproval || behavior.approvalSurface === "none") return false;
  if (roleCode === ROLE_CODES.ADMIN) return true;
  const owner =
    options.ownerRoleCode ??
    behavior.ownerRoleCode ??
    TEXTILE_APPROVAL_OWNER_ROLE[approvalCode] ??
    null;
  if (!owner) return false;
  if (roleCode !== owner) return false;
  void options.isAssignee;
  return true;
}

/**
 * Owner role / Admin may see stage approvals for their codes even when assigned
 * to someone else (Approvals hub + design detail). Without an acting role, only
 * the assignee (or unassigned personal queue) sees the item.
 */
export function canRoleSeeStageApproval(
  roleCode: string | null | undefined,
  approvalCode: string,
  options: {
    isAssignee?: boolean;
    isUnassigned?: boolean;
    ownerRoleCode?: string | null;
    capabilities?: unknown;
  } = {},
): boolean {
  if (canRoleActOnStageApproval(roleCode, approvalCode, options)) return true;
  return Boolean(options.isAssignee || options.isUnassigned);
}

export type ApprovalHubTabs = {
  stage: boolean;
  ready: boolean;
};

export type ApprovalHubTabId = keyof ApprovalHubTabs;

/** Role owns ≥1 textile stage-approval code, or Admin oversee. */
export function canRoleSeeStageApprovalsHub(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  if (roleCode === ROLE_CODES.ADMIN) return true;
  return Object.values(TEXTILE_APPROVAL_OWNER_ROLE).includes(roleCode);
}

/**
 * Which Approvals hub tabs each role may see.
 * Option A: Stage gates + Design Head ready-to-approve only (no management decide chain).
 */
export function getApprovalHubTabsForRole(roleCode: string | null | undefined): ApprovalHubTabs {
  return {
    stage: canRoleSeeStageApprovalsHub(roleCode),
    ready: canRoleSeeReadyForSignOff(roleCode),
  };
}

export function canRoleAccessApprovalsHub(roleCode: string | null | undefined): boolean {
  const tabs = getApprovalHubTabsForRole(roleCode);
  return tabs.stage || tabs.ready;
}

export function isApprovalHubTabAllowed(
  roleCode: string | null | undefined,
  tab: ApprovalHubTabId,
): boolean {
  return getApprovalHubTabsForRole(roleCode)[tab];
}

/**
 * Deep-link into Approvals hub using only tabs the role can open.
 * Legacy preferred "management" maps to ready (DH) or stage.
 */
export function approvalsHubHrefForRole(
  roleCode: string | null | undefined,
  preferred?: ApprovalHubTabId | "management",
): string {
  const tabs = getApprovalHubTabsForRole(roleCode);
  const normalized: ApprovalHubTabId | undefined =
    preferred === "management" ? (tabs.ready ? "ready" : "stage") : preferred;
  const order: ApprovalHubTabId[] = normalized
    ? [normalized, "stage", "ready"]
    : ["stage", "ready"];
  // Keep path in sync with ROUTES.quality.approvals (avoid importing routes → cycle).
  const base = "/quality/approvals";
  for (const tab of order) {
    if (tabs[tab]) return `${base}?tab=${tab}`;
  }
  return base;
}

export function filterStageApprovalsForRole<
  T extends { stageCode: string; ownerRoleCode?: string | null },
>(roleCode: string | null | undefined, items: T[]): T[] {
  if (!roleCode) return [];
  if (roleCode === ROLE_CODES.ADMIN) return items;
  return items.filter((item) => {
    const owner = getStageApprovalOwnerRole(item.stageCode, item.ownerRoleCode);
    return owner === roleCode;
  });
}
