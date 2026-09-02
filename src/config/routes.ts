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
  IconPlus,
  IconClock,
  IconUsers,
  IconRoles,
  IconWorkflow,
  IconLock,
} from "@/components/icons";

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
    pipelineDependencies: "/work/pipeline-dependencies",
  },
  quality: {
    corrections: "/quality/corrections",
    approvals: "/quality/approvals",
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
        label: "Overview",
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
      {
        id: "designs-kanban",
        label: "Pipeline Board",
        href: ROUTES.designs.kanban,
        icon: IconDesigns,
        permission: PERMISSIONS.DESIGN_CREATE,
      },
      {
        id: "designs-new",
        label: "New Concept",
        href: ROUTES.designs.new,
        icon: IconPlus,
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
        permission: PERMISSIONS.DESIGN_APPROVE,
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
        id: "pipeline-dependencies",
        label: "Pipeline Dependencies",
        href: ROUTES.work.pipelineDependencies,
        icon: IconTasks,
        anyPermission: [
          PERMISSIONS.DESIGN_CREATE,
          PERMISSIONS.KPI_ADMIN,
          PERMISSIONS.MASTER_ADMIN,
        ],
      },
      {
        id: "time-live",
        label: "Live Team Time",
        href: ROUTES.admin.timeLive,
        icon: IconClock,
        permission: PERMISSIONS.TIME_VIEW_TEAM,
      },
      {
        id: "time-report",
        label: "Time Report",
        href: ROUTES.analytics.timeReport,
        icon: IconClock,
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
        icon: IconKpi,
        permission: PERMISSIONS.KPI_ADMIN,
        exact: true,
      },
      {
        id: "reports-corrections",
        label: "Correction Analysis",
        href: ROUTES.analytics.reportsCorrections,
        icon: IconKpi,
        permission: PERMISSIONS.KPI_ADMIN,
      },
      {
        id: "reports-design-success",
        label: "Design Success",
        href: ROUTES.analytics.reportsDesignSuccess,
        icon: IconKpi,
        permission: PERMISSIONS.KPI_ADMIN,
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
        icon: IconDesigns,
        permission: PERMISSIONS.PRODUCTION_RELEASE,
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
        label: "Process Masters",
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
        icon: IconLock,
        permission: PERMISSIONS.MASTER_ADMIN,
      },
    ],
  },
];

export type BreadcrumbItem = { label: string; href?: string };

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  [ROUTES.dashboard]: [{ label: "Overview" }],
  [ROUTES.designs.list]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Designs" },
  ],
  [ROUTES.designs.kanban]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Designs", href: ROUTES.designs.list },
    { label: "Pipeline Board" },
  ],
  [ROUTES.designs.new]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Designs", href: ROUTES.designs.list },
    { label: "New Concept" },
  ],
  [ROUTES.work.tasks]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "My Tasks" },
  ],
  [ROUTES.work.myTime]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "My Time Today" },
  ],
  [ROUTES.work.pipelineDependencies]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Pipeline Dependencies" },
  ],
  [ROUTES.quality.corrections]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Corrections" },
  ],
  [ROUTES.quality.approvals]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Approvals" },
  ],
  [ROUTES.finance.costing]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Costing" },
  ],
  [ROUTES.analytics.kpi]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI" },
  ],
  [ROUTES.analytics.kpiEmployees]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Employee KPI" },
  ],
  [ROUTES.analytics.kpiDesignHead]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Design Head KPI" },
  ],
  [ROUTES.analytics.timeReport]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Time Report" },
  ],
  [ROUTES.analytics.reportsHub]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Reports Hub" },
  ],
  [ROUTES.analytics.reportsCorrections]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Correction Analysis" },
  ],
  [ROUTES.analytics.reportsDesignSuccess]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Performance KPI", href: ROUTES.analytics.kpi },
    { label: "Design Success" },
  ],
  [ROUTES.admin.masters]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Process Masters" },
  ],
  [ROUTES.admin.workflowPatterns]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Workflow Patterns" },
  ],
  [ROUTES.admin.timeLive]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Live Team Time" },
  ],
  [ROUTES.admin.roles]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Roles & Access" },
  ],
  [ROUTES.admin.employees]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Employees" },
  ],
  [ROUTES.admin.audit]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Audit Log" },
  ],
  [ROUTES.production.release]: [
    { label: "Overview", href: ROUTES.dashboard },
    { label: "Production Release" },
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

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.id === "approvals" && !showApprovals) return false;
      if (item.anyPermission?.length) {
        return item.anyPermission.some((p) => permissions.includes(p));
      }
      return !item.permission || permissions.includes(item.permission);
    }),
  })).filter((section) => section.items.length > 0);
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (ROUTE_BREADCRUMBS[pathname]) {
    return ROUTE_BREADCRUMBS[pathname];
  }

  const designDetail = pathname.match(/^\/designs\/([^/]+)$/);
  if (designDetail && designDetail[1] !== "new") {
    return [
      { label: "Overview", href: ROUTES.dashboard },
      { label: "Designs", href: ROUTES.designs.list },
      { label: designDetail[1] },
    ];
  }

  const designTask = pathname.match(/^\/designs\/([^/]+)\/tasks\/([^/]+)$/);
  if (designTask) {
    return [
      { label: "Overview", href: ROUTES.dashboard },
      { label: "Designs", href: ROUTES.designs.list },
      { label: designTask[1], href: ROUTES.designs.detail(designTask[1]) },
      { label: "Task" },
    ];
  }

  const workTask = pathname.match(/^\/work\/tasks\/([^/]+)$/);
  if (workTask) {
    return [
      { label: "Overview", href: ROUTES.dashboard },
      { label: "My Tasks", href: ROUTES.work.tasks },
      { label: workTask[1] },
    ];
  }

  return [{ label: "Overview", href: ROUTES.dashboard }];
}

export function getPageTitle(pathname: string): string {
  const crumbs = getBreadcrumbsForPath(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "Decent ERP";
}
