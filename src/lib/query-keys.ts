export const queryKeys = {
  designs: {
    all: ["designs"] as const,
    kanban: ["designs", "kanban"] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ["designs", "list", filters] as const,
    detail: (id: string) => ["designs", "detail", id] as const,
    completionSummary: (id: string) => ["designs", "completion-summary", id] as const,
    images: (id: string) => ["designs", "images", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    my: ["tasks", "my"] as const,
    actionCenter: ["tasks", "action-center"] as const,
    pipelineDependencies: ["tasks", "pipeline-dependencies"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  time: {
    mySummary: ["time", "my-summary"] as const,
    live: ["time", "live"] as const,
    report: (from?: string, to?: string) => ["time", "report", from, to] as const,
  },
  masters: {
    processes: ["masters", "processes"] as const,
    workflowPatterns: ["masters", "workflow-patterns"] as const,
    holdReasons: ["masters", "hold-reasons"] as const,
    productTypes: ["masters", "product-types"] as const,
    productTypesAdmin: ["masters", "product-types", "all"] as const,
    seasons: ["masters", "seasons"] as const,
    seasonsAdmin: ["masters", "seasons", "all"] as const,
    productProcessMappings: (productTypeId?: number) =>
      ["masters", "product-process-mappings", productTypeId] as const,
    componentTypes: ["masters", "component-types"] as const,
    checklistItems: ["masters", "checklist-items"] as const,
    employees: ["masters", "employees"] as const,
  },
  kpi: {
    employees: ["kpi", "employees"] as const,
    designHead: ["kpi", "design-head"] as const,
  },
  reports: {
    corrections: ["reports", "corrections"] as const,
    designSuccess: (year: number, month: number) =>
      ["reports", "design-success", year, month] as const,
  },
  corrections: {
    all: ["corrections"] as const,
    list: (filters?: { designId?: string; mine?: boolean; status?: string }) =>
      ["corrections", "list", filters] as const,
  },
  approvals: {
    pending: ["approvals", "pending"] as const,
    stage: ["approvals", "stage"] as const,
    ready: ["approvals", "ready"] as const,
    hub: ["approvals", "hub"] as const,
    levels: ["approvals", "levels"] as const,
    all: ["approvals"] as const,
  },
  costs: {
    list: (designId: string) => ["costs", designId] as const,
  },
  production: {
    approved: ["production", "approved"] as const,
    released: ["production", "released"] as const,
    handoffs: (designId?: string) => ["production", "handoffs", designId] as const,
    erpStatus: ["production", "erp-status"] as const,
    inbox: ["production", "inbox"] as const,
    returnOptions: (designId: string) => ["production", "return-options", designId] as const,
  },
  audit: {
    list: (filters?: Record<string, string>) => ["audit", filters] as const,
  },
  dashboard: {
    designHead: ["dashboard", "design-head"] as const,
    management: ["dashboard", "management"] as const,
  },
  notifications: {
    list: ["notifications"] as const,
  },
  admin: {
    dashboard: ["admin", "dashboard"] as const,
    employees: ["admin", "employees"] as const,
    roles: ["admin", "roles"] as const,
    rbacMatrix: ["admin", "rbac-matrix"] as const,
    rolePermissions: (roleId: number) => ["admin", "roles", roleId, "permissions"] as const,
    suggestCode: ["admin", "employees", "suggest-code"] as const,
  },
} as const;
