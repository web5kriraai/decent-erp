import { ROLE_CODES } from "@/lib/permissions";

/** Management sign-off chain level codes (Layer 2) - aligned with seed ApprovalLevel rows. */
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

/** Roles that participate in the Checker → Design Head → Management decide chain. */
export function canRoleSeeManagementSignOff(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  if (roleCode === ROLE_CODES.ADMIN) return true;
  return Object.values(MANAGEMENT_LEVEL_OWNER_ROLE).includes(roleCode);
}

/** Filter pending management-queue items to levels this role may decide. */
export function filterManagementApprovalsForRole<
  T extends { currentLevel: { code?: string } },
>(roleCode: string | null | undefined, items: T[]): T[] {
  if (!roleCode) return [];
  if (roleCode === ROLE_CODES.ADMIN) return items;
  return items.filter((item) =>
    canRoleActOnManagementLevel(roleCode, item.currentLevel.code ?? ""),
  );
}
