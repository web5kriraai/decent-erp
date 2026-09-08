export const queryKeys = {
  designs: {
    all: ["designs"] as const,
    kanban: ["designs", "kanban"] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ["designs", "list", filters] as const,
    detail: (id: string) => ["designs", "detail", id] as const,
    completionSummary: (id: string) => ["designs", "completion-summary", id] as const,
    productionReadiness: (id: string) => ["designs", "production-readiness", id] as const,
    images: (id: string) => ["designs", "images", id] as const,
    kpiContribution: (id: string) => ["designs", "kpi-contribution", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    my: ["tasks", "my"] as const,
    actionCenter: ["tasks", "action-center"] as const,
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
    workflowPatternPreview: (id: number, taskDateMode: string, priority: string) =>
      ["masters", "workflow-patterns", id, "preview", taskDateMode, priority] as const,
    holdReasons: ["masters", "hold-reasons"] as const,
    skills: ["masters", "skills"] as const,
    catalog: (masterType?: string, includeInactive?: boolean) =>
      ["masters", "catalog", masterType ?? "all", includeInactive ? "all" : "active"] as const,
    catalogSummary: (includeInactive?: boolean) =>
      ["masters", "catalog", "summary", includeInactive ? "all" : "active"] as const,
    productTypes: ["masters", "product-types"] as const,
    productTypesAdmin: ["masters", "product-types", "all"] as const,
    seasons: ["masters", "seasons"] as const,
    seasonsAdmin: ["masters", "seasons", "all"] as const,
    componentTypes: ["masters", "component-types"] as const,
    checklistItems: ["masters", "checklist-items"] as const,
    employees: ["masters", "employees"] as const,
    fabrics: ["masters", "fabrics"] as const,
    fabricsAdmin: ["masters", "fabrics", "all"] as const,
    machines: ["masters", "machines"] as const,
    machinesAdmin: ["masters", "machines", "all"] as const,
    stitchingTypes: ["masters", "stitching-types"] as const,
    stitchingTypesAdmin: ["masters", "stitching-types", "all"] as const,
    designGrades: ["masters", "design-grades"] as const,
    designGradesAdmin: ["masters", "design-grades", "all"] as const,
    correctionReasons: ["masters", "correction-reasons"] as const,
    correctionReasonsAdmin: ["masters", "correction-reasons", "all"] as const,
    conceptTargets: (year: number, month: number) =>
      ["masters", "concept-targets", year, month] as const,
    materials: (designId?: string) => ["masters", "materials", designId ?? "all"] as const,
    kpiDefinitions: ["masters", "kpi-definitions"] as const,
  },
  kpi: {
    /** Prefix for invalidateQueries - matches all employee KPI list pages. */
    employeesRoot: ["kpi", "employees"] as const,
    employees: (page?: number, pageSize?: number) =>
      ["kpi", "employees", { page, pageSize }] as const,
    designHead: ["kpi", "design-head"] as const,
    performance: (employeeId: number | string, year?: number, month?: number) =>
      ["kpi", "performance", String(employeeId), year, month] as const,
  },
  reports: {
    corrections: ["reports", "corrections"] as const,
    designSuccess: (year: number, month: number) =>
      ["reports", "design-success", year, month] as const,
    sampleStatus: (year: number, month: number) =>
      ["reports", "sample-status", year, month] as const,
    productionStart: (year: number, month: number) =>
      ["reports", "production-start", year, month] as const,
  },
  corrections: {
    all: ["corrections"] as const,
    list: (filters?: { designId?: string; mine?: boolean; status?: string }) =>
      ["corrections", "list", filters] as const,
  },
  approvals: {
    pending: ["approvals", "pending"] as const,
    hub: ["approvals", "hub"] as const,
    all: ["approvals"] as const,
  },
  costs: {
    list: (designId: string) => ["costs", designId] as const,
  },
  production: {
    approved: ["production", "approved"] as const,
    released: ["production", "released"] as const,
    /** Prefix for invalidateQueries - matches list + per-design handoff keys. */
    handoffsRoot: ["production", "handoffs"] as const,
    handoffs: (designId?: string) =>
      designId
        ? (["production", "handoffs", "design", designId] as const)
        : (["production", "handoffs", "list"] as const),
    erpStatus: ["production", "erp-status"] as const,
    /** Prefix for invalidateQueries - matches list + per-design ERP stage keys. */
    erpStagesRoot: ["production", "erp-stages"] as const,
    erpStages: (designId?: string) =>
      designId
        ? (["production", "erp-stages", "design", designId] as const)
        : (["production", "erp-stages", "list"] as const),
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
  },
} as const;
