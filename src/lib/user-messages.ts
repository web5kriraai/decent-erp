import type { PermissionCode } from "@/lib/permissions";

/** Plain-language labels shown in UI instead of raw permission codes. */
import {
  formatPermissionActionLabel,
  PERMISSION_CATALOG,
} from "@/lib/permission-catalog";

/** @deprecated Prefer formatPermissionActionLabel / PERMISSION_CATALOG */
export const PERMISSION_LABELS: Record<PermissionCode, string> = Object.fromEntries(
  (Object.keys(PERMISSION_CATALOG) as PermissionCode[]).map((code) => [
    code,
    PERMISSION_CATALOG[code].actionLabel,
  ]),
) as Record<PermissionCode, string>;

export function formatPermissionLabel(code: string): string {
  return formatPermissionActionLabel(code);
}

export function permissionDeniedMessage(required: string | string[]): string {
  const list = Array.isArray(required) ? required : [required];
  if (list.length === 1) {
    return `You can't do this yet - your role doesn't include permission to ${formatPermissionLabel(list[0])}. Ask your system admin to turn this on under Admin → Roles & Access.`;
  }
  const labels = list.map(formatPermissionLabel).join(", or ");
  return `You can't do this yet - your role needs permission to ${labels}. Ask your system admin under Admin → Roles & Access.`;
}

export function accessRestrictedMessage(permission?: string): string {
  if (!permission) {
    return "This section isn't available for your role. If you need access, ask your system admin.";
  }
  return `This section is for people who can ${formatPermissionLabel(permission)}. If that's part of your job, ask your system admin to enable it for your role.`;
}

export function sessionPermissionsStaleHint(): string {
  return "If your admin just updated your role, sign out and sign back in to pick up the new access.";
}
