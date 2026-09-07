import { z } from "zod";
import { ROLE_CODES } from "@/lib/permissions";

export const STAGE_APPROVAL_SURFACES = [
  "inline_card",
  "task_panel",
  "task_end_dialog",
  "none",
] as const;

export const STAGE_APPROVAL_ACTIONS = [
  "approve",
  "correction",
  "reject",
  "resample",
] as const;

export const STAGE_ON_COMPLETE_HOOKS = [
  "sampleDecision",
  "costingPersist",
  "unlockErp",
] as const;

export const workPrecursorSchema = z.union([
  z.object({ bySequence: z.literal("previous_dependency") }),
  z.object({ bySubProcessCode: z.string().min(1) }),
]);

export const stageCapabilitiesSchema = z.object({
  isApproval: z.boolean().default(false),
  requiresFile: z.boolean().default(false),
  isCorrectionAllowed: z.boolean().default(true),

  forcesChecking: z.boolean().default(false),
  machineOutput: z.boolean().default(false),
  sampleDecisionOutcomes: z.boolean().default(false),
  costingEntry: z.boolean().default(false),
  /** End dialog completes without CHECKING option (PROD_RELEASE-style). */
  completeNotChecking: z.boolean().default(false),

  approvalSurface: z.enum(STAGE_APPROVAL_SURFACES).default("none"),
  approvalActions: z.array(z.enum(STAGE_APPROVAL_ACTIONS)).default([]),
  showCompare: z.boolean().default(false),
  showGallery: z.boolean().default(false),
  showChecklist: z.boolean().default(false),
  approvalTitle: z.string().optional(),

  /** Gate linkage — which work stage unlocks this approval. */
  workPrecursor: workPrecursorSchema.optional(),
  /**
   * When precursor must be CHECKING only vs CHECKING|COMPLETED.
   * Defaults: checking when precursor forcesChecking; checking_or_completed otherwise.
   */
  workGateMode: z
    .enum(["always", "checking", "checking_or_completed"])
    .optional(),

  unlockAfterDesignApproved: z.boolean().default(false),
  autoAdvanceOnCreate: z.boolean().default(false),

  onComplete: z.array(z.enum(STAGE_ON_COMPLETE_HOOKS)).default([]),
});

export type StageCapabilities = z.infer<typeof stageCapabilitiesSchema>;
export type StageApprovalAction = (typeof STAGE_APPROVAL_ACTIONS)[number];
export type StageApprovalSurface = (typeof STAGE_APPROVAL_SURFACES)[number];
export type StageOnCompleteHook = (typeof STAGE_ON_COMPLETE_HOOKS)[number];

export const DEFAULT_STAGE_CAPABILITIES: StageCapabilities = stageCapabilitiesSchema.parse({});

function caps(partial: Partial<StageCapabilities>): StageCapabilities {
  return stageCapabilitiesSchema.parse(partial);
}

/**
 * Parity map: every seeded textile code → today's hardcoded behavior.
 * Used as seed payload and as runtime fallback when DB capabilities are null.
 */
export const TEXTILE_CAPABILITIES_BY_CODE: Record<string, StageCapabilities> = {
  CONCEPT_REVIEW: caps({
    isApproval: true,
    approvalSurface: "inline_card",
    approvalActions: ["approve", "correction", "reject"],
    approvalTitle: "Concept review — your action",
    workGateMode: "always",
    autoAdvanceOnCreate: true,
  }),
  SKETCH: caps({
    requiresFile: true,
    forcesChecking: true,
    isCorrectionAllowed: true,
  }),
  SKETCH_APPROVAL: caps({
    isApproval: true,
    approvalSurface: "inline_card",
    approvalActions: ["approve", "correction", "reject"],
    showCompare: true,
    showGallery: true,
    approvalTitle: "Sketch ready for your approval",
    workPrecursor: { bySubProcessCode: "SKETCH" },
    // COMPLETED covers legacy/bypass data where sketch was closed past CHECKING.
    workGateMode: "checking_or_completed",
  }),
  PUNCH: caps({
    requiresFile: true,
    forcesChecking: true,
    isCorrectionAllowed: true,
  }),
  PUNCH_CHECK: caps({
    isApproval: true,
    approvalSurface: "task_panel",
    approvalActions: ["approve", "correction", "reject"],
    showCompare: true,
    showGallery: true,
    approvalTitle: "Punching check — review decision",
    workPrecursor: { bySubProcessCode: "PUNCH" },
    workGateMode: "checking_or_completed",
  }),
  CORRECTION: caps({
    isCorrectionAllowed: true,
  }),
  MAT_REQ: caps({
    isCorrectionAllowed: true,
  }),
  FABRIC_ISSUE: caps({
    isCorrectionAllowed: true,
  }),
  MACHINE_SAMPLE: caps({
    requiresFile: true,
    forcesChecking: true,
    machineOutput: true,
    isCorrectionAllowed: true,
  }),
  SAMPLE_RECEIVE: caps({
    forcesChecking: true,
    machineOutput: true,
    isCorrectionAllowed: true,
  }),
  SAMPLE_CHECK: caps({
    isApproval: true,
    approvalSurface: "task_end_dialog",
    approvalActions: ["approve", "reject", "resample"],
    showChecklist: true,
    approvalTitle: "Sample check decision",
    sampleDecisionOutcomes: true,
    workPrecursor: { bySubProcessCode: "MACHINE_SAMPLE" },
    workGateMode: "checking",
    onComplete: ["sampleDecision"],
  }),
  RESAMPLE: caps({
    machineOutput: true,
    forcesChecking: true,
    isCorrectionAllowed: true,
  }),
  COSTING: caps({
    forcesChecking: true,
    costingEntry: true,
    isCorrectionAllowed: true,
    onComplete: ["costingPersist"],
  }),
  FINAL_APPROVAL: caps({
    isApproval: true,
    approvalSurface: "inline_card",
    approvalActions: ["approve", "correction", "reject"],
    approvalTitle: "Final approval — costing & sample ready?",
    workPrecursor: { bySubProcessCode: "COSTING" },
    workGateMode: "checking_or_completed",
  }),
  PROD_HANDOFF: caps({
    completeNotChecking: true,
    unlockAfterDesignApproved: true,
    isCorrectionAllowed: true,
  }),
  PROD_INSTRUCTION: caps({
    completeNotChecking: true,
    unlockAfterDesignApproved: true,
    isCorrectionAllowed: true,
  }),
  PROD_RELEASE: caps({
    completeNotChecking: true,
    unlockAfterDesignApproved: true,
    isCorrectionAllowed: true,
    onComplete: ["unlockErp"],
  }),
  LIVE_REVIEW: caps({
    isApproval: true,
    approvalSurface: "task_panel",
    approvalActions: ["approve"],
    approvalTitle: "Live Design Review — go-live decision",
    workPrecursor: { bySubProcessCode: "PROD_RELEASE" },
    workGateMode: "checking_or_completed",
    unlockAfterDesignApproved: true,
  }),
};

/** Historical owner roles for textile approvals (seed defaultRoleId remains source of truth at runtime). */
export const TEXTILE_APPROVAL_OWNER_ROLE: Record<string, string> = {
  CONCEPT_REVIEW: ROLE_CODES.DESIGN_HEAD,
  SKETCH_APPROVAL: ROLE_CODES.DESIGN_HEAD,
  PUNCH_CHECK: ROLE_CODES.SAMPLE_CHECKER,
  SAMPLE_CHECK: ROLE_CODES.SAMPLE_CHECKER,
  FINAL_APPROVAL: ROLE_CODES.DESIGN_HEAD,
  LIVE_REVIEW: ROLE_CODES.MANAGEMENT,
};

/**
 * Parse DB / form JSON as a partial layer for merge.
 * Do not apply Zod defaults here — that would poison merge with `isApproval: false`
 * and wipe textile / column layers.
 */
export function parseStageCapabilities(raw: unknown): Partial<StageCapabilities> | null {
  if (raw == null) return null;
  const parsed = stageCapabilitiesSchema.partial().safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function capabilitiesForTextileCode(code: string): StageCapabilities | null {
  return TEXTILE_CAPABILITIES_BY_CODE[code] ?? null;
}

export function mergeStageCapabilities(
  ...layers: Array<Partial<StageCapabilities> | null | undefined>
): StageCapabilities {
  const merged: Partial<StageCapabilities> = {};
  for (const layer of layers) {
    if (!layer) continue;
    Object.assign(merged, layer);
  }
  return stageCapabilitiesSchema.parse(merged);
}
