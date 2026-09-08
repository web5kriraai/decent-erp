import type { ComponentType } from "react";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import { canRoleAccessApprovalsHub } from "@/lib/stage-approval-rbac";
import {
  IconDashboard,
  IconDesigns,
  IconTasks,
  IconCorrections,
  IconApprovals,
  IconCosting,
  IconKpi,
  IconMasters,
  IconClock,
  IconTeamTime,
  IconTimeReport,
  IconUsers,
  IconRoles,
  IconWorkflow,
  IconAudit,
  IconProduction,
  IconErpChain,
  IconReports,
} from "@/components/icons";
import { getRoleDefinition } from "@/config/roles";

export const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",
  designs: {
    list: "/designs",
    kanban: "/designs/kanban",
    new: "/designs/new",
    detail: (id: string) => `/designs/${id}`,
    task: (designId: string, taskId: string) => `/designs/${designId}/tasks/${taskId}`,
  },
  work: {
    tasks: "/work/tasks",
    taskDetail: (taskId: string) => `/work/tasks/${taskId}`,
    myTime: "/work/time",
    materials: "/work/materials",
    sketch: "/work/sketch",
    punching: "/work/punching",
    samples: "/work/samples",
    sampleKanban: "/work/samples/kanban",
  },
  quality: {
    corrections: "/quality/corrections",
    approvals: "/quality/approvals",
    requestSignOff: (designId: string) =>
      `/quality/approvals/request-sign-off/${designId}`,
  },
  finance: {
    costing: "/finance/costing",
  },
  analytics: {
    kpi: "/analytics/kpi",
    kpiEmployees: "/analytics/kpi/employees",
    kpiDesignHead: "/analytics/kpi/design-head",
    timeReport: "/analytics/time",
    reportsCorrections: "/analytics/reports/corrections",
    reportsDesignSuccess: "/analytics/reports/design-success",
    reportsSampleStatus: "/analytics/reports/sample-status",
    reportsProductionStart: "/analytics/reports/production-start",
    reportsMaterial: "/analytics/reports/material",
    reportsDelay: "/analytics/reports/delay",
    reportsDesignerRanking: "/analytics/reports/designer-ranking",
    reportsHub: "/analytics/reports",
  },
  admin: {
    masters: "/admin/masters",
    workflowPatterns: "/admin/workflow-patterns",
    timeLive: "/admin/time/live",
    employees: "/admin/employees",
    roles: "/admin/roles",
    audit: "/admin/audit",
  },
  production: {
    release: "/production/release",
    erpChain: "/production/erp",
  },
} as const;

/** Legacy paths → canonical slugs (permanent redirects in middleware) */
export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/tasks": ROUTES.work.tasks,
  "/corrections": ROUTES.quality.corrections,
  "/approvals": ROUTES.quality.approvals,
  "/costing": ROUTES.finance.costing,
  "/kpi": ROUTES.analytics.kpi,
  "/masters": ROUTES.admin.masters,
};

export type NavIcon = ComponentType<{ size?: number; className?: string }>;

export type NavLink = {
  id: string;
  label: string;
  href: string;
  icon?: NavIcon;
  permission?: PermissionCode;
  /** Visible when the user has any of these permissions (OR). */
  anyPermission?: PermissionCode[];
  /** Match exact path only (not children) */
  exact?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavLink[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    label: "Main",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: ROUTES.dashboard,
        icon: IconDashboard,
        exact: true,
      },
    ],
  },
  {
    id: "design-pipeline",
    label: "Design Pipeline",
    items: [
      {
        id: "designs-list",
        label: "All Designs",
        href: ROUTES.designs.list,
        icon: IconDesigns,
        permission: PERMISSIONS.DESIGN_CREATE,
      },
    ],
  },
  {
    id: "my-work",
    label: "My Work",
    items: [
      {
        id: "work-tasks",
        label: "My Tasks",
        href: ROUTES.work.tasks,
        icon: IconTasks,
        permission: PERMISSIONS.TASK_EXECUTE,
      },
      {
        id: "work-time",
        label: "My Time Today",
        href: ROUTES.work.myTime,
        icon: IconClock,
        permission: PERMISSIONS.TASK_EXECUTE,
      },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    items: [
      {
        id: "corrections",
        label: "Corrections",
        href: ROUTES.quality.corrections,
        icon: IconCorrections,
        permission: PERMISSIONS.CORRECTION_RAISE,
      },
      {
        id: "approvals",
        label: "Approvals",
        href: ROUTES.quality.approvals,
        icon: IconApprovals,
        // Visibility gated by canRoleAccessApprovalsHub in getVisibleNavSections
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "costing",
        label: "Costing",
        href: ROUTES.finance.costing,
        icon: IconCosting,
        permission: PERMISSIONS.COST_VIEW,
      },
    ],
  },
  {
    id: "team-reports",
    label: "Team & Reports",
    items: [
        {
        id: "time-live",
        label: "Live Team Time",
        href: ROUTES.admin.timeLive,
        icon: IconTeamTime,
        permission: PERMISSIONS.TIME_VIEW_TEAM,
      },
      {
        id: "time-report",
        label: "Time Report",
        href: ROUTES.analytics.timeReport,
        icon: IconTimeReport,
        permission: PERMISSIONS.TIME_VIEW_TEAM,
      },
      {
        id: "kpi",
        label: "Performance KPI",
        href: ROUTES.analytics.kpi,
        icon: IconKpi,
        permission: PERMISSIONS.KPI_ADMIN,
      },
      {
        id: "reports-hub",
        label: "Reports Hub",
        href: ROUTES.analytics.reportsHub,
        icon: IconReports,
        permission: PERMISSIONS.KPI_ADMIN,
        exact: true,
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    items: [
      {
        id: "production-release",
        label: "Production Release",
        href: ROUTES.production.release,
        icon: IconProduction,
        permission: PERMISSIONS.PRODUCTION_RELEASE,
      },
      {
        id: "production-erp",
        label: "ERP Chain",
        href: ROUTES.production.erpChain,
        icon: IconErpChain,
        anyPermission: [
          PERMISSIONS.ERP_FLOOR_OPERATE,
          PERMISSIONS.ERP_SALES_OPERATE,
          PERMISSIONS.ERP_ACCOUNTS_OPERATE,
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "System Admin",
    items: [
      {
        id: "employees",
        label: "Employees",
        href: ROUTES.admin.employees,
        icon: IconUsers,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
      {
        id: "roles",
        label: "Roles & Access",
        href: ROUTES.admin.roles,
        icon: IconRoles,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
      {
        id: "masters",
        label: "Master Data",
        href: ROUTES.admin.masters,
        icon: IconMasters,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
      {
        id: "workflow-patterns",
        label: "Workflow Patterns",
        href: ROUTES.admin.workflowPatterns,
        icon: IconWorkflow,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
      {
        id: "audit",
        label: "Audit Log",
        href: ROUTES.admin.audit,
        icon: IconAudit,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
    ],
  },
];

export type BreadcrumbItem = { label: string; href?: string };

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  [ROUTES.dashboard]: [{ label: "Dashboard" }],
  [ROUTES.designs.list]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Designs" },
  ],
  [ROUTES.designs.kanban]: [
    { label: "Dashboard", href: ROUTES.dashboard },
  ],
  [ROUTES.designs.new]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Designs", href: ROUTES.designs.list },
    { label: "New Concept" },
  ],
  [ROUTES.work.tasks]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Tasks" },
  ],
  [ROUTES.work.myTime]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Time Today" },
  ],
  [ROUTES.work.materials]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Tasks", href: ROUTES.work.tasks },
    { label: "Materials" },
  ],
  [ROUTES.work.sketch]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Tasks", href: ROUTES.work.tasks },
    { label: "Sketch Board" },
  ],
  [ROUTES.work.punching]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Tasks", href: ROUTES.work.tasks },
    { label: "Punching Board" },
  ],
  [ROUTES.work.samples]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "My Tasks", href: ROUTES.work.tasks },
    { label: "Sample Board" },
  ],
  [ROUTES.work.sampleKanban]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Sample Board", href: ROUTES.work.samples },
    { label: "Sample Kanban" },
  ],
  [ROUTES.quality.corrections]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Corrections" },
  ],
  [ROUTES.quality.approvals]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Approvals" },
  ],
  [ROUTES.finance.costing]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Costing" },
  ],
  [ROUTES.analytics.kpi]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Performance KPI" },
  ],
  [ROUTES.analytics.kpiEmployees]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Employee KPI" },
  ],
  [ROUTES.analytics.kpiDesignHead]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Design Head KPI" },
  ],
  [ROUTES.analytics.timeReport]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Time Report" },
  ],
  [ROUTES.analytics.reportsHub]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub" },
  ],
  [ROUTES.analytics.reportsCorrections]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Correction Analysis" },
  ],
  [ROUTES.analytics.reportsDesignSuccess]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Design Success" },
  ],
  [ROUTES.analytics.reportsSampleStatus]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Sample Status" },
  ],
  [ROUTES.analytics.reportsProductionStart]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Production Start" },
  ],
  [ROUTES.analytics.reportsMaterial]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Material Analysis" },
  ],
  [ROUTES.analytics.reportsDelay]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Delay Analysis" },
  ],
  [ROUTES.analytics.reportsDesignerRanking]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Reports Hub", href: ROUTES.analytics.reportsHub },
    { label: "Designer Ranking" },
  ],
  [ROUTES.admin.masters]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Master Data" },
  ],
  [ROUTES.admin.workflowPatterns]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Workflow Patterns" },
  ],
  [ROUTES.admin.timeLive]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Live Team Time" },
  ],
  [ROUTES.admin.roles]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Roles & Access" },
  ],
  [ROUTES.admin.employees]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Employees" },
  ],
  [ROUTES.admin.audit]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Audit Log" },
  ],
  [ROUTES.production.release]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "Production Release" },
  ],
  [ROUTES.production.erpChain]: [
    { label: "Dashboard", href: ROUTES.dashboard },
    { label: "ERP Chain" },
  ],
};

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  if (href === ROUTES.designs.list && pathname.startsWith("/designs/")) {
    return pathname !== ROUTES.designs.new && pathname !== ROUTES.designs.kanban;
  }
  return pathname.startsWith(`${href}/`);
}

export function getVisibleNavSections(permissions: string[], roleCode?: string): NavSection[] {
  const showApprovals = roleCode
    ? canRoleAccessApprovalsHub(roleCode)
    : permissions.includes(PERMISSIONS.DESIGN_APPROVE);

  const filtered = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.id === "approvals" && !showApprovals) return false;
      if (item.anyPermission?.length) {
        return item.anyPermission.some((p) => permissions.includes(p));
      }
      return !item.permission || permissions.includes(item.permission);
    }),
  })).filter((section) => section.items.length > 0);

  return orderNavSectionsForRole(filtered, roleCode);
}

/** Main first, then ROLE_CATALOG.navFocus labels, then remaining (admin last). */
export function orderNavSectionsForRole(sections: NavSection[], roleCode?: string): NavSection[] {
  if (sections.length <= 1) return sections;

  const byId = new Map(sections.map((s) => [s.id, s]));
  const byLabel = new Map(sections.map((s) => [s.label, s]));
  const used = new Set<string>();
  const ordered: NavSection[] = [];

  const push = (section: NavSection | undefined) => {
    if (!section || used.has(section.id)) return;
    used.add(section.id);
    ordered.push(section);
  };

  push(byId.get("main"));

  const roleDef = roleCode ? getRoleDefinition(roleCode) : undefined;
  const focus = roleDef?.navFocus ?? [];
  for (const label of focus) {
    if (label === "Main" || label === "All modules") continue;
    push(byLabel.get(label));
  }

  for (const section of sections) {
    if (section.id === "admin") continue;
    push(section);
  }

  push(byId.get("admin"));

  return ordered;
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (ROUTE_BREADCRUMBS[pathname]) {
    return ROUTE_BREADCRUMBS[pathname];
  }

  const designDetail = pathname.match(/^\/designs\/([^/]+)$/);
  if (designDetail && designDetail[1] !== "new") {
    return [
      { label: "Dashboard", href: ROUTES.dashboard },
      { label: "Designs", href: ROUTES.designs.list },
      { label: designDetail[1] },
    ];
  }

  const designTask = pathname.match(/^\/designs\/([^/]+)\/tasks\/([^/]+)$/);
  if (designTask) {
    return [
      { label: "Dashboard", href: ROUTES.dashboard },
      { label: "Designs", href: ROUTES.designs.list },
      { label: designTask[1], href: ROUTES.designs.detail(designTask[1]) },
      { label: "Task" },
    ];
  }

  const workTask = pathname.match(/^\/work\/tasks\/([^/]+)$/);
  if (workTask) {
    return [
      { label: "Dashboard", href: ROUTES.dashboard },
      { label: "My Tasks", href: ROUTES.work.tasks },
      { label: workTask[1] },
    ];
  }

  const requestSignOff = pathname.match(
    /^\/quality\/approvals\/request-sign-off\/([^/]+)$/,
  );
  if (requestSignOff) {
    return [
      { label: "Dashboard", href: ROUTES.dashboard },
      { label: "Approvals", href: `${ROUTES.quality.approvals}?tab=ready` },
      { label: requestSignOff[1] },
      { label: "Request Sign-off" },
    ];
  }

  return [{ label: "Dashboard", href: ROUTES.dashboard }];
}

export function getPageTitle(pathname: string): string {
  const crumbs = getBreadcrumbsForPath(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "Decent ERP";
}
