/** Production stages unlocked only after design is APPROVED (management chain complete). */
export const PRODUCTION_POST_APPROVAL_CODES = [
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
] as const;

export type ProductionPostApprovalCode = (typeof PRODUCTION_POST_APPROVAL_CODES)[number];

export function isProductionPostApprovalCode(code: string): boolean {
  return (PRODUCTION_POST_APPROVAL_CODES as readonly string[]).includes(code);
}

export function formatProductionReleaseMissing(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Production release is not available yet.\n\nMissing:\n• ${missing.join("\n• ")}`;
}
