# Role × screen matrix

Derived from [`src/config/routes.ts`](../src/config/routes.ts) NAV_SECTIONS and default permissions.

| Role | Primary screens | Core permissions |
|------|-----------------|------------------|
| Design Head | Dashboard, My Tasks, All Designs, Approvals, Costing, Corrections | DESIGN_CREATE, DESIGN_ASSIGN*, DESIGN_APPROVE, CORRECTION_* |
| Sketch / Punch / Machine | My Tasks, My Time | TASK_EXECUTE, CORRECTION_EXECUTE |
| Sample Checker | My Tasks, Approvals, Corrections | TASK_EXECUTE, APPROVE_LEVEL_1, CORRECTION_* |
| Costing Team | Costing, My Tasks | COST_ENTER, COST_VIEW, TASK_EXECUTE |
| Production Head | Production desk, My Tasks | PRODUCTION_*, ERP_FLOOR_OPERATE |
| Management | Approvals, KPI, Live review tasks | FINAL_APPROVE, MARK_LIVE, KPI_ADMIN |
| Admin | Masters, Employees, RBAC, Workflow patterns, Assignment rules, Audit | MASTER_ADMIN |

\* `DESIGN_ASSIGN` grants both manual and auto until matrix is split.

Design detail **Activity** tab: requires `WORKFLOW_VIEW_HISTORY` or design pipeline access.
