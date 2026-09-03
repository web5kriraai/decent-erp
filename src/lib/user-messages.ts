import type { PermissionCode } from "@/lib/permissions";

/** Plain-language labels shown in UI instead of raw permission codes. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  DESIGN_CREATE: "create and edit design concepts",
  DESIGN_ASSIGN: "assign tasks to team members",
  TASK_EXECUTE: "run tasks on My Tasks",
  TIME_VIEW_TEAM: "view team time reports",
  CORRECTION_RAISE: "raise corrections",
  DESIGN_APPROVE: "record design approvals",
  COST_VIEW: "view costing",
  KPI_ADMIN: "manage KPI settings",
  MASTER_ADMIN: "manage system settings and roles",
  PRODUCTION_RELEASE: "release designs to production",
  WORKFLOW_OVERRIDE: "override workflow phases",
  ERP_FLOOR_OPERATE: "run Grey through Ready Stock on the ERP Chain",
  ERP_SALES_OPERATE: "post Sales and Sales Return on the ERP Chain",
  ERP_ACCOUNTS_OPERATE: "post Accounts / margin on the ERP Chain",
};

export function formatPermissionLabel(code: string): string {
  return PERMISSION_LABELS[code as PermissionCode] ?? code.replace(/_/g, " ").toLowerCase();
}

export function permissionDeniedMessage(required: string | string[]): string {
  const list = Array.isArray(required) ? required : [required];
  if (list.length === 1) {
    return `You can't do this yet — your role doesn't include permission to ${formatPermissionLabel(list[0])}. Ask your system admin to turn this on under Admin → Roles & Access.`;
  }
  const labels = list.map(formatPermissionLabel).join(", or ");
  return `You can't do this yet — your role needs permission to ${labels}. Ask your system admin under Admin → Roles & Access.`;
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
