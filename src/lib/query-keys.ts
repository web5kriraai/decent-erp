export const queryKeys = {
  designs: {
    all: ["designs"] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ["designs", "list", filters] as const,
    detail: (id: string) => ["designs", "detail", id] as const,
    images: (id: string) => ["designs", "images", id] as const,
  },
  tasks: {
    my: ["tasks", "my"] as const,
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
    seasons: ["masters", "seasons"] as const,
    employees: ["masters", "employees"] as const,
  },
  kpi: {
    employees: ["kpi", "employees"] as const,
    designHead: ["kpi", "design-head"] as const,
  },
  corrections: {
    all: ["corrections"] as const,
    list: (filters?: { designId?: string; mine?: boolean; status?: string }) =>
      ["corrections", "list", filters] as const,
  },
  approvals: {
    pending: ["approvals", "pending"] as const,
    levels: ["approvals", "levels"] as const,
  },
  costs: {
    list: (designId: string) => ["costs", designId] as const,
  },
  production: {
    approved: ["production", "approved"] as const,
  },
  audit: {
    list: (filters?: Record<string, string>) => ["audit", filters] as const,
  },
  admin: {
    employees: ["admin", "employees"] as const,
    roles: ["admin", "roles"] as const,
    suggestCode: ["admin", "employees", "suggest-code"] as const,
  },
} as const;
