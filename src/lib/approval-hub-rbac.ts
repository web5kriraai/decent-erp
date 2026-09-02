import { ROLE_CODES } from "@/lib/permissions";

/** Management sign-off chain level codes (Layer 2) — aligned with seed ApprovalLevel rows. */
export const MANAGEMENT_APPROVAL_LEVEL_CODES = [
  "CHECKER_APPROVAL",
  "DESIGN_HEAD_APPROVAL",
  "MANAGEMENT_APPROVAL",
] as const;

export type ManagementApprovalLevelCode = (typeof MANAGEMENT_APPROVAL_LEVEL_CODES)[number];

export const MANAGEMENT_LEVEL_OWNER_ROLE: Record<ManagementApprovalLevelCode, string> = {
  CHECKER_APPROVAL: ROLE_CODES.SAMPLE_CHECKER,
  DESIGN_HEAD_APPROVAL: ROLE_CODES.DESIGN_HEAD,
  MANAGEMENT_APPROVAL: ROLE_CODES.MANAGEMENT,
};

export function getManagementLevelOwnerRole(levelCode: string): string | null {
  if (!(MANAGEMENT_APPROVAL_LEVEL_CODES as readonly string[]).includes(levelCode)) {
    return null;
  }
  return MANAGEMENT_LEVEL_OWNER_ROLE[levelCode as ManagementApprovalLevelCode];
}

export function canRoleActOnManagementLevel(
  roleCode: string | null | undefined,
  levelCode: string,
): boolean {
  if (!roleCode) return false;
  if (roleCode === ROLE_CODES.ADMIN) return true;
  const owner = getManagementLevelOwnerRole(levelCode);
  return owner === roleCode;
}

export function canRoleSeeReadyForSignOff(roleCode: string | null | undefined): boolean {
  return roleCode === ROLE_CODES.DESIGN_HEAD;
}

export function canRoleSeeManagementSignOff(roleCode: string | null | undefined): boolean {
  return (
    roleCode === ROLE_CODES.ADMIN ||
    roleCode === ROLE_CODES.SAMPLE_CHECKER ||
    roleCode === ROLE_CODES.DESIGN_HEAD ||
    roleCode === ROLE_CODES.MANAGEMENT
  );
}
