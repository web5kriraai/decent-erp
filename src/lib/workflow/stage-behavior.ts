import {
  capabilitiesForTextileCode,
  mergeStageCapabilities,
  parseStageCapabilities,
  type StageApprovalAction,
  type StageApprovalSurface,
  type StageCapabilities,
  type StageOnCompleteHook,
  DEFAULT_STAGE_CAPABILITIES,
} from "@/lib/workflow/stage-capabilities";

export type StageBehaviorInput = {
  code: string;
  name?: string;
  isApproval?: boolean;
  isFileRequired?: boolean;
  isCorrectionAllowed?: boolean;
  /** Raw JSON from DesignSubProcessMaster.capabilities */
  capabilities?: unknown;
  /** Optional WorkflowPatternTask.capabilitiesOverride */
  capabilitiesOverride?: unknown;
  /** Role code that owns this stage (from defaultRole). */
  defaultRoleCode?: string | null;
};

export type EndDialogMode =
  | "sample_check"
  | "execute_checking"
  | "execute_complete"
  | "stage_approval"
  | "machine";

export type ResolvedStageBehavior = {
  code: string;
  name: string;
  capabilities: StageCapabilities;
  ownerRoleCode: string | null;

  isApproval: boolean;
  requiresFile: boolean;
  isCorrectionAllowed: boolean;
  forcesChecking: boolean;
  machineOutput: boolean;
  sampleDecisionOutcomes: boolean;
  costingEntry: boolean;
  completeNotChecking: boolean;
  unlockAfterDesignApproved: boolean;
  autoAdvanceOnCreate: boolean;

  approvalSurface: StageApprovalSurface;
  approvalActions: StageApprovalAction[];
  showCompare: boolean;
  showGallery: boolean;
  showChecklist: boolean;
  approvalTitle?: string;

  workPrecursorCode: string | null;
  workGateMode: "always" | "checking" | "checking_or_completed";
  onComplete: StageOnCompleteHook[];

  endDialogMode: EndDialogMode;
};

/**
 * Column flags only — never invent approvalSurface/actions here.
 * Inventing `task_panel` used to overwrite textile `inline_card` whenever
 * `isApproval: true` was passed from the DB, hiding design-page approve cards.
 */
function columnFallback(input: StageBehaviorInput): Partial<StageCapabilities> {
  const partial: Partial<StageCapabilities> = {};
  if (input.isApproval != null) {
    partial.isApproval = !!input.isApproval;
  }
  if (input.isFileRequired != null) {
    partial.requiresFile = !!input.isFileRequired;
  }
  if (input.isCorrectionAllowed != null) {
    partial.isCorrectionAllowed = !!input.isCorrectionAllowed;
  }
  return partial;
}

/** Custom / unknown approval stages without a surface still need a usable default. */
function ensureApprovalSurface(caps: StageCapabilities): StageCapabilities {
  if (!caps.isApproval || caps.approvalSurface !== "none") return caps;
  return {
    ...caps,
    approvalSurface: "task_panel",
    approvalActions:
      caps.approvalActions.length > 0
        ? caps.approvalActions
        : ["approve", "correction", "reject"],
  };
}

function deriveWorkGateMode(caps: StageCapabilities): "always" | "checking" | "checking_or_completed" {
  if (caps.workGateMode) return caps.workGateMode;
  if (!caps.isApproval) return "always";
  if (!caps.workPrecursor) return "always";
  return "checking";
}

function deriveEndDialogMode(caps: StageCapabilities): EndDialogMode {
  if (caps.sampleDecisionOutcomes) return "sample_check";
  if (caps.isApproval && caps.approvalSurface !== "task_end_dialog") return "stage_approval";
  if (caps.isApproval && caps.approvalSurface === "task_end_dialog") return "sample_check";
  if (caps.machineOutput) return "machine";
  if (caps.costingEntry) return "execute_checking";
  if (caps.completeNotChecking) return "execute_complete";
  if (caps.forcesChecking) return "execute_checking";
  return "execute_complete";
}

/**
 * Resolve runtime stage behavior from capabilities metadata (with textile + column fallbacks).
 * Codes are IDs only — behavior comes from capabilities.
 */
export function resolveStageBehavior(input: StageBehaviorInput): ResolvedStageBehavior {
  const textile = capabilitiesForTextileCode(input.code);
  const fromDb = parseStageCapabilities(input.capabilities);
  const override = parseStageCapabilities(input.capabilitiesOverride);

  const capabilities = ensureApprovalSurface(
    mergeStageCapabilities(
      DEFAULT_STAGE_CAPABILITIES,
      textile,
      columnFallback(input),
      fromDb,
      override,
    ),
  );

  const workPrecursorCode =
    capabilities.workPrecursor && "bySubProcessCode" in capabilities.workPrecursor
      ? capabilities.workPrecursor.bySubProcessCode
      : null;

  const workGateMode = deriveWorkGateMode(capabilities);

  return {
    code: input.code,
    name: input.name ?? input.code,
    capabilities,
    ownerRoleCode: input.defaultRoleCode ?? null,

    isApproval: capabilities.isApproval,
    requiresFile: capabilities.requiresFile,
    isCorrectionAllowed: capabilities.isCorrectionAllowed,
    forcesChecking: capabilities.forcesChecking,
    machineOutput: capabilities.machineOutput,
    sampleDecisionOutcomes: capabilities.sampleDecisionOutcomes,
    costingEntry: capabilities.costingEntry,
    completeNotChecking: capabilities.completeNotChecking,
    unlockAfterDesignApproved: capabilities.unlockAfterDesignApproved,
    autoAdvanceOnCreate: capabilities.autoAdvanceOnCreate,

    approvalSurface: capabilities.approvalSurface,
    approvalActions: capabilities.approvalActions,
    showCompare: capabilities.showCompare,
    showGallery: capabilities.showGallery,
    showChecklist: capabilities.showChecklist,
    approvalTitle: capabilities.approvalTitle,

    workPrecursorCode,
    workGateMode,
    onComplete: capabilities.onComplete,

    endDialogMode: deriveEndDialogMode(capabilities),
  };
}

export function isStageApprovalActionableFromBehavior(
  behavior: ResolvedStageBehavior,
  workTask?: { status?: string } | null,
): boolean {
  if (!behavior.isApproval) return false;
  if (behavior.workGateMode === "always") return true;
  if (!workTask?.status) return false;
  if (behavior.workGateMode === "checking") return workTask.status === "CHECKING";
  return ["CHECKING", "COMPLETED"].includes(workTask.status);
}

export function workPrecursorCodeForApproval(code: string, capabilities?: unknown): string | null {
  return resolveStageBehavior({ code, capabilities }).workPrecursorCode;
}

export function isUnlockAfterDesignApprovedStage(
  code: string,
  capabilities?: unknown,
): boolean {
  return resolveStageBehavior({ code, capabilities }).unlockAfterDesignApproved;
}

export function isAutoAdvanceOnCreateStage(code: string, capabilities?: unknown): boolean {
  return resolveStageBehavior({ code, capabilities }).autoAdvanceOnCreate;
}

export function hasOnCompleteHook(
  code: string,
  hook: StageOnCompleteHook,
  capabilities?: unknown,
): boolean {
  return resolveStageBehavior({ code, capabilities }).onComplete.includes(hook);
}
