import type { PermissionCode } from "@/lib/permissions";

/** Plain-language labels shown in UI instead of raw permission codes. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  DESIGN_CREATE: "create and edit design concepts",
  DESIGN_ASSIGN: "assign tasks to team members",
  DESIGN_ASSIGN_MANUAL: "assign tasks manually at concept create",
  DESIGN_ASSIGN_AUTO: "use automatic workflow assignment",
  DESIGN_REASSIGN: "reassign workflow tasks",
  TASK_EXECUTE: "run tasks on My Tasks",
  TIME_VIEW_TEAM: "view team time reports",
  CORRECTION_RAISE: "raise corrections",
  CORRECTION_REQUEST: "request corrections",
  CORRECTION_EXECUTE: "execute correction rework",
  CORRECTION_APPROVE: "approve completed corrections",
  CORRECTION_REJECT: "reject corrections",
  DESIGN_APPROVE: "approve designs for production",
  APPROVE_LEVEL_1: "first-level sample approval",
  APPROVE_SKETCH: "approve sketches",
  FINAL_APPROVE: "final design approval",
  MARK_LIVE: "mark designs live",
  WORKFLOW_VIEW_HISTORY: "view design activity history",
  COST_VIEW: "view costing",
  COST_ENTER: "enter costing",
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
