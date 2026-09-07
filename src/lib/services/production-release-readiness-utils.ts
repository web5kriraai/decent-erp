/** Pure pattern-aware production release stage gaps (no DB). */

import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

/** Inactive / bypassed stages — never block release and never require files. */
export const RELEASE_INACTIVE_STATUSES = new Set(["SKIPPED", "CANCELLED"]);

/** Work stages that may sit in CHECKING while still counting as delivered. */
const WORK_SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED", "SKIPPED"]);

/** Approval stages: completed or explicitly bypassed. */
const APPROVAL_SATISFIED = new Set(["COMPLETED", "SKIPPED", "CANCELLED"]);

/** Textile-friendly labels for parity with historical readiness messages. */
const TEXTILE_LABELS: Record<string, { label: string; fileLabel?: string }> = {
  SKETCH: { label: "Sketch work", fileLabel: "Sketch file" },
  SKETCH_APPROVAL: { label: "Sketch approval" },
  PUNCH: { label: "Punching / Wilcom work", fileLabel: "Punching file" },
  PUNCH_CHECK: { label: "Punching checking approval" },
  MAT_REQ: { label: "Material requirement" },
  FABRIC_ISSUE: { label: "Fabric / component issue" },
  MACHINE_SAMPLE: { label: "Machine sample", fileLabel: "Machine sample file" },
  SAMPLE_CHECK: { label: "Sample approval" },
  FINAL_APPROVAL: { label: "Design Head final approval stage" },
  PROD_HANDOFF: { label: "Production handoff from Design Head" },
  PROD_INSTRUCTION: { label: "Production instruction" },
};

export type ReadinessTaskSnapshot = {
  status: string;
  isFileRequired?: boolean;
  hasFile?: boolean;
  isApproval?: boolean;
  capabilities?: unknown;
  code?: string;
  name?: string;
};

export function isReleaseInactiveStatus(status: string): boolean {
  return RELEASE_INACTIVE_STATUSES.has(status);
}

/** True when Design Head final gate is done or the pattern never included it. */
export function isDesignHeadFinalGateSatisfied(
  tasksByCode: Record<string, ReadinessTaskSnapshot | undefined>,
): boolean {
  const final = tasksByCode.FINAL_APPROVAL;
  if (!final) return true;
  return APPROVAL_SATISFIED.has(final.status);
}

const POST_APPROVAL_STATUSES = new Set([
  "APPROVED",
  "PRODUCTION_ACCEPTED",
  "PRODUCTION_RELEASED",
  "LIVE",
]);

/**
 * Spec Stage 9 — Management ApprovalLevel chain is mandatory before production release.
 * Once the design is past APPROVED, levels are historical (already decided).
 * `hasAnyDesignApproval` is retained for callers/tests but does not waive the chain.
 */
export function shouldRequireManagementApprovalLevels(input: {
  designStatus: string;
  hasAnyDesignApproval: boolean;
}): boolean {
  void input.hasAnyDesignApproval;
  return !POST_APPROVAL_STATUSES.has(input.designStatus);
}

/**
 * Lifecycle: only APPROVED+ satisfies release. ACTIVE/ON_HOLD/APPROVAL_PENDING
 * must complete the management decide chain (no short-pattern bypass).
 */
export function isDesignLifecycleReadyForRelease(input: {
  designStatus: string;
  finalGateSatisfied: boolean;
  managementDecideStarted: boolean;
}): boolean {
  void input.finalGateSatisfied;
  void input.managementDecideStarted;
  return POST_APPROVAL_STATUSES.has(input.designStatus);
}

/**
 * Design-side and production-ladder stages required only when present on the design.
 * Absent PROD_HANDOFF / PROD_INSTRUCTION are not gaps (flexible / short patterns).
 * SKIPPED / CANCELLED stages never require completion or files.
 */
export function collectPresentStageGaps(
  tasksByCode: Record<string, ReadinessTaskSnapshot | undefined>,
): string[] {
  const missing: string[] = [];

  for (const [code, task] of Object.entries(tasksByCode)) {
    if (!task) continue;
    if (code === "PROD_RELEASE" || code === "LIVE_REVIEW") continue;
    if (isReleaseInactiveStatus(task.status)) continue;

    const behavior = resolveStageBehavior({
      code,
      isApproval: task.isApproval,
      isFileRequired: task.isFileRequired,
      capabilities: task.capabilities,
    });

    const textile = TEXTILE_LABELS[code];
    const label = textile?.label ?? task.name ?? code;

    if (code === "PROD_HANDOFF" || code === "PROD_INSTRUCTION") {
      if (task.status !== "COMPLETED") {
        missing.push(textile?.label ?? label);
      }
      continue;
    }

    const mustBeApprovalComplete = behavior.isApproval;
    const ok = mustBeApprovalComplete
      ? APPROVAL_SATISFIED.has(task.status)
      : WORK_SATISFIED.has(task.status);
    if (!ok) {
      missing.push(label);
      continue;
    }

    const requiresFile = task.isFileRequired === true;
    if (requiresFile && !task.hasFile) {
      missing.push(textile?.fileLabel ?? `${label} file`);
    }
  }

  return missing;
}
