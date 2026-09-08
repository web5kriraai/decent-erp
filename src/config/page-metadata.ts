import type { Metadata } from "next";

export const APP_NAME = "Decent ERP";
export const APP_DEFAULT_DESCRIPTION =
  "Product design lifecycle for textile and garment products";

export type PageMeta = {
  title: string;
  description: string;
};

/** Static route metadata - titles match nav / breadcrumbs. */
const PAGE_META = {
  login: {
    title: "Sign In",
    description: "Sign in to Decent ERP",
  },
  dashboard: {
    title: "Dashboard",
    description: "Design workflow dashboard",
  },
  designs: {
    title: "All Designs",
    description: "All designs",
  },
  designsKanban: {
    title: "Dashboard",
    description: "Design workflow dashboard (redirects to home)",
  },
  designsNew: {
    title: "New Concept",
    description: "New design concept",
  },
  designDetail: {
    title: "Design Detail",
    description: "Design details",
  },
  designTask: {
    title: "Design Task",
    description: "Design task",
  },
  workTasks: {
    title: "My Tasks",
    description: "Your tasks",
  },
  workTaskDetail: {
    title: "Task Detail",
    description: "Task details",
  },
  workTime: {
    title: "My Time Today",
    description: "Your time today",
  },
  workSketch: {
    title: "Sketch Board",
    description: "Sketch workbench",
  },
  workPunching: {
    title: "Punching Board",
    description: "Punching workbench",
  },
  workMaterials: {
    title: "Materials",
    description: "Materials workbench",
  },
  workSamples: {
    title: "Sample Board",
    description: "Sample workbench",
  },
  corrections: {
    title: "Corrections",
    description: "Corrections",
  },
  approvals: {
    title: "Approvals",
    description: "Pending approvals",
  },
  requestSignOff: {
    title: "Request Sign-off",
    description: "Request management approval",
  },
  costing: {
    title: "Costing",
    description: "Design costing",
  },
  kpi: {
    title: "Performance KPI",
    description: "Performance KPIs",
  },
  kpiEmployees: {
    title: "Employee KPI",
    description: "Employee KPIs",
  },
  kpiDesignHead: {
    title: "Design Head KPI",
    description: "Design Head KPIs",
  },
  timeReport: {
    title: "Time Report",
    description: "Time report",
  },
  reportsCorrections: {
    title: "Correction Analysis",
    description: "Correction analysis",
  },
  reportsDesignSuccess: {
    title: "Design Success Report",
    description: "Design success",
  },
  reportsSampleStatus: {
    title: "Sample Status Report",
    description: "Sample decisions by stage",
  },
  reportsProductionStart: {
    title: "Production Start Report",
    description: "Production starts by product type",
  },
  reportsHub: {
    title: "Reports Hub",
    description: "Reports",
  },
  productionRelease: {
    title: "Production Release",
    description: "Production release",
  },
  productionErpChain: {
    title: "ERP Chain",
    description: "Production ERP chain",
  },
  adminEmployees: {
    title: "Employees",
    description: "Employees",
  },
  adminRoles: {
    title: "Roles & Access",
    description: "Roles and access",
  },
  adminMasters: {
    title: "Master Data",
    description: "Processes, catalog lookups, targets, and KPI weights",
  },
  adminWorkflowPatterns: {
    title: "Workflow Patterns",
    description: "Workflow patterns",
  },
  adminTimeLive: {
    title: "Live Team Time",
    description: "Live team time",
  },
  adminAudit: {
    title: "Audit Log",
    description: "Audit log",
  },
} as const satisfies Record<string, PageMeta>;

export type PageMetaKey = keyof typeof PAGE_META;

function buildPageMetadata(meta: PageMeta): Metadata {
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

export function requestSignOffMetadata(designId: string): Metadata {
  return {
    title: `Request Sign-off · ${designId}`,
    description: PAGE_META.requestSignOff.description,
  };
}
