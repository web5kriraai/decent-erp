export const queryKeys = {
  designs: {
    all: ["designs"] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ["designs", "list", filters] as const,
    detail: (id: string) => ["designs", "detail", id] as const,
  },
  tasks: {
    my: ["tasks", "my"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
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
  },
  approvals: {
    pending: ["approvals", "pending"] as const,
  },
} as const;
