import {
  PERMISSIONS,
  type PermissionCode,
} from "@/lib/permissions";

/**
 * Canonical permission metadata for Roles & Access, seed, and denied-access copy.
 * Codes themselves live in `PERMISSIONS`; this file owns labels, groups, and order.
 */

export const PERMISSION_GROUPS = {
  DESIGN: "DESIGN",
  TASKS: "TASKS",
  QUALITY: "QUALITY",
  FINANCE: "FINANCE",
  ANALYTICS: "ANALYTICS",
  PRODUCTION: "PRODUCTION",
  SYSTEM: "SYSTEM",
} as const;

export type PermissionGroupCode =
  (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS];

export type PermissionDefinition = {
  code: PermissionCode;
  title: string;
  /** Short phrase used in “you can’t do X” messages */
  actionLabel: string;
  description: string;
  group: PermissionGroupCode;
  sortOrder: number;
};

export const PERMISSION_GROUP_META: Record<
  PermissionGroupCode,
  { title: string; description: string; sortOrder: number }
> = {
  DESIGN: {
    title: "Design pipeline",
    description: "Create concepts, assign work, and move designs through stages",
    sortOrder: 1,
  },
  TASKS: {
    title: "My work / timers",
    description: "Execute assigned tasks and track time",
    sortOrder: 2,
  },
  QUALITY: {
    title: "Quality & corrections",
    description: "Raise rework and approve design quality gates",
    sortOrder: 3,
  },
  FINANCE: {
    title: "Finance & costing",
    description: "View and enter development costs",
    sortOrder: 4,
  },
  ANALYTICS: {
    title: "Team & analytics",
    description: "Team time, KPI, and performance views",
    sortOrder: 5,
  },
  PRODUCTION: {
    title: "Production & ERP chain",
    description: "Production release and ERP shop-floor / sales / accounts",
    sortOrder: 6,
  },
  SYSTEM: {
    title: "System admin",
    description: "Employees, roles, masters, and workflow patterns",
    sortOrder: 7,
  },
};

export const PERMISSION_CATALOG: Record<PermissionCode, PermissionDefinition> = {
  [PERMISSIONS.DESIGN_CREATE]: {
    code: PERMISSIONS.DESIGN_CREATE,
    title: "Create designs",
    actionLabel: "create and edit design concepts",
    description: "Create and edit design concepts, components, and files",
    group: PERMISSION_GROUPS.DESIGN,
    sortOrder: 10,
  },
  [PERMISSIONS.DESIGN_ASSIGN]: {
    code: PERMISSIONS.DESIGN_ASSIGN,
    title: "Assign tasks",
    actionLabel: "assign tasks to team members",
    description: "Assign or reassign design stage tasks to employees",
    group: PERMISSION_GROUPS.DESIGN,
    sortOrder: 20,
  },
  [PERMISSIONS.WORKFLOW_OVERRIDE]: {
    code: PERMISSIONS.WORKFLOW_OVERRIDE,
    title: "Override workflow",
    actionLabel: "override workflow phases",
    description: "Bypass or jump stages (Send to QC / Bypass to phase)",
    group: PERMISSION_GROUPS.DESIGN,
    sortOrder: 30,
  },
  [PERMISSIONS.TASK_EXECUTE]: {
    code: PERMISSIONS.TASK_EXECUTE,
    title: "Execute tasks",
    actionLabel: "run tasks on My Tasks",
    description: "Start, hold, resume, and complete assigned tasks with timers",
    group: PERMISSION_GROUPS.TASKS,
    sortOrder: 10,
  },
  [PERMISSIONS.CORRECTION_RAISE]: {
    code: PERMISSIONS.CORRECTION_RAISE,
    title: "Raise corrections",
    actionLabel: "raise corrections",
    description: "Raise correction loops and route rework to earlier stages",
    group: PERMISSION_GROUPS.QUALITY,
    sortOrder: 10,
  },
  [PERMISSIONS.DESIGN_APPROVE]: {
    code: PERMISSIONS.DESIGN_APPROVE,
    title: "Approve designs",
    actionLabel: "approve designs for production",
    description: "Approve stage / management quality gates and creativity ratings",
    group: PERMISSION_GROUPS.QUALITY,
    sortOrder: 20,
  },
  [PERMISSIONS.COST_VIEW]: {
    code: PERMISSIONS.COST_VIEW,
    title: "View costing",
    actionLabel: "view costing",
    description: "View and enter design development cost entries",
    group: PERMISSION_GROUPS.FINANCE,
    sortOrder: 10,
  },
  [PERMISSIONS.TIME_VIEW_TEAM]: {
    code: PERMISSIONS.TIME_VIEW_TEAM,
    title: "Team time",
    actionLabel: "view team time reports",
    description: "Live team time board and historical time reports",
    group: PERMISSION_GROUPS.ANALYTICS,
    sortOrder: 10,
  },
  [PERMISSIONS.KPI_ADMIN]: {
    code: PERMISSIONS.KPI_ADMIN,
    title: "KPI & performance",
    actionLabel: "manage KPI settings",
    description: "KPI dashboard, recompute, and performance grades",
    group: PERMISSION_GROUPS.ANALYTICS,
    sortOrder: 20,
  },
  [PERMISSIONS.PRODUCTION_RELEASE]: {
    code: PERMISSIONS.PRODUCTION_RELEASE,
    title: "Production release",
    actionLabel: "release designs to production",
    description: "Accept or hold designs released to production",
    group: PERMISSION_GROUPS.PRODUCTION,
    sortOrder: 10,
  },
  [PERMISSIONS.ERP_FLOOR_OPERATE]: {
    code: PERMISSIONS.ERP_FLOOR_OPERATE,
    title: "ERP floor",
    actionLabel: "run Grey through Ready Stock on the ERP Chain",
    description: "Operate Grey → Ready Stock stages on the ERP Chain",
    group: PERMISSION_GROUPS.PRODUCTION,
    sortOrder: 20,
  },
  [PERMISSIONS.ERP_SALES_OPERATE]: {
    code: PERMISSIONS.ERP_SALES_OPERATE,
    title: "ERP sales",
    actionLabel: "post Sales and Sales Return on the ERP Chain",
    description: "Post Sales and Sales Return on the ERP Chain",
    group: PERMISSION_GROUPS.PRODUCTION,
    sortOrder: 30,
  },
  [PERMISSIONS.ERP_ACCOUNTS_OPERATE]: {
    code: PERMISSIONS.ERP_ACCOUNTS_OPERATE,
    title: "ERP accounts",
    actionLabel: "post Accounts / margin on the ERP Chain",
    description: "Post Accounts / margin steps on the ERP Chain",
    group: PERMISSION_GROUPS.PRODUCTION,
    sortOrder: 40,
  },
  [PERMISSIONS.MASTER_ADMIN]: {
    code: PERMISSIONS.MASTER_ADMIN,
    title: "System admin",
    actionLabel: "manage system settings and roles",
    description: "Employees, Roles & Access, masters, workflow patterns, audit",
    group: PERMISSION_GROUPS.SYSTEM,
    sortOrder: 10,
  },
};

export const ALL_PERMISSION_CODES = Object.values(PERMISSIONS) as PermissionCode[];

export function getPermissionDefinition(code: string): PermissionDefinition | undefined {
  return PERMISSION_CATALOG[code as PermissionCode];
}

export function formatPermissionTitle(code: string): string {
  return getPermissionDefinition(code)?.title ?? code.replace(/_/g, " ");
}

export function formatPermissionActionLabel(code: string): string {
  return (
    getPermissionDefinition(code)?.actionLabel ??
    code.replace(/_/g, " ").toLowerCase()
  );
}

export function listPermissionsByGroup(): Array<{
  group: PermissionGroupCode;
  meta: (typeof PERMISSION_GROUP_META)[PermissionGroupCode];
  permissions: PermissionDefinition[];
}> {
  const byGroup = new Map<PermissionGroupCode, PermissionDefinition[]>();
  for (const def of Object.values(PERMISSION_CATALOG)) {
    const list = byGroup.get(def.group) ?? [];
    list.push(def);
    byGroup.set(def.group, list);
  }

  return Object.values(PERMISSION_GROUPS)
    .map((group) => ({
      group,
      meta: PERMISSION_GROUP_META[group],
      permissions: (byGroup.get(group) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((g) => g.permissions.length > 0)
    .sort((a, b) => a.meta.sortOrder - b.meta.sortOrder);
}

/** Ordered flat list matching Roles & Access matrix row order */
export function listPermissionsOrdered(): PermissionDefinition[] {
  return listPermissionsByGroup().flatMap((g) => g.permissions);
}

export function assertCatalogCoversAllPermissions(): void {
  for (const code of ALL_PERMISSION_CODES) {
    if (!PERMISSION_CATALOG[code]) {
      throw new Error(`PERMISSION_CATALOG missing entry for ${code}`);
    }
  }
}
