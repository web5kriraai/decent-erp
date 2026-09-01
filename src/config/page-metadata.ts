import type { Metadata } from "next";

export const APP_NAME = "Decent ERP";
export const APP_DEFAULT_DESCRIPTION =
  "End-to-end product design lifecycle for textile and garment products";

export type PageMeta = {
  title: string;
  description: string;
};

/** Static route metadata — titles match nav / breadcrumbs. */
export const PAGE_META = {
  login: {
    title: "Sign In",
    description: "Sign in to the Decent ERP design management workspace",
  },
  dashboard: {
    title: "Overview",
    description: "Design operations dashboard — tasks, designs, and time at a glance",
  },
  designs: {
    title: "All Designs",
    description: "Browse and manage product design concepts across the pipeline",
  },
  designsKanban: {
    title: "Pipeline Board",
    description: "Kanban board of designs by workflow stage",
  },
  designsNew: {
    title: "New Concept",
    description: "Create a new design concept with workflow assignment",
  },
  designDetail: {
    title: "Design Detail",
    description: "Design concept details, tasks, images, and status",
  },
  designTask: {
    title: "Design Task",
    description: "Execute and track a design workflow task",
  },
  workTasks: {
    title: "My Tasks",
    description: "Your assigned design tasks and active timer",
  },
  workTaskDetail: {
    title: "Task Detail",
    description: "Task timer, artifacts, checklist, and completion",
  },
  workTime: {
    title: "My Time Today",
    description: "Your active time, holds, and workday summary",
  },
  corrections: {
    title: "Corrections",
    description: "Corrections you raised, own on a task, or are responsible for fixing",
  },
  approvals: {
    title: "Approvals",
    description: "Review and approve designs pending quality sign-off",
  },
  costing: {
    title: "Costing",
    description: "Material and process cost entries for designs",
  },
  kpi: {
    title: "Performance KPI",
    description: "Team and process performance KPIs",
  },
  kpiEmployees: {
    title: "Employee KPI",
    description: "Per-employee productivity and quality metrics",
  },
  kpiDesignHead: {
    title: "Design Head KPI",
    description: "Design-head portfolio and success metrics",
  },
  timeReport: {
    title: "Time Report",
    description: "Team time reports by employee and process",
  },
  productionRelease: {
    title: "Production Release",
    description: "Release approved designs to ERP production modules",
  },
  adminEmployees: {
    title: "Employees",
    description: "Manage employees, roles, and account status",
  },
  adminRoles: {
    title: "Roles & Access",
    description: "Configure role permissions and access matrix",
  },
  adminMasters: {
    title: "Process Masters",
    description: "Design processes, sub-processes, and product mappings",
  },
  adminWorkflowPatterns: {
    title: "Workflow Patterns",
    description: "Reusable workflow templates for automatic task assignment",
  },
  adminTimeLive: {
    title: "Live Team Time",
    description: "Real-time view of team task timers and status",
  },
  adminAudit: {
    title: "Audit Log",
    description: "System audit trail of sensitive actions",
  },
} as const satisfies Record<string, PageMeta>;

export type PageMetaKey = keyof typeof PAGE_META;

export function buildPageMetadata(meta: PageMeta): Metadata {
  return {
    title: meta.title,
    description: meta.description,
  };
}

export function pageMetadata(key: PageMetaKey): Metadata {
  return buildPageMetadata(PAGE_META[key]);
}

export function designDetailMetadata(designId: string): Metadata {
  return {
    title: `Design ${designId}`,
    description: PAGE_META.designDetail.description,
  };
}

export function designTaskMetadata(_designId: string, taskId: string): Metadata {
  return {
    title: `Task ${taskId}`,
    description: PAGE_META.designTask.description,
  };
}

export function workTaskMetadata(taskId: string): Metadata {
  return {
    title: `Task ${taskId}`,
    description: PAGE_META.workTaskDetail.description,
  };
}
