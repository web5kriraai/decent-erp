import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

/** @deprecated Prefer unlockAfterDesignApproved capability — textile ladder snapshot. */
export const PRODUCTION_POST_APPROVAL_CODES = [
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
] as const;

export type ProductionPostApprovalCode = (typeof PRODUCTION_POST_APPROVAL_CODES)[number];

export function isProductionPostApprovalCode(
  code: string,
  capabilities?: unknown,
): boolean {
  return resolveStageBehavior({ code, capabilities }).unlockAfterDesignApproved;
}

export function formatProductionReleaseMissing(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Production release is not available yet.\n\nMissing:\n• ${missing.join("\n• ")}`;
}
