export const WORKFLOW_ACTION_CODES = {
  OPEN_TASK: "OPEN_TASK",
  REQUEST_APPROVAL: "REQUEST_APPROVAL",
  OPEN_APPROVALS_QUEUE: "OPEN_APPROVALS_QUEUE",
  ASSIGN_TASK: "ASSIGN_TASK",

  START_TASK: "START_TASK",
  HOLD_TASK: "HOLD_TASK",
  RESUME_TASK: "RESUME_TASK",
  END_TASK: "END_TASK",

  APPROVE_LEVEL: "APPROVE_LEVEL",
  REJECT_LEVEL: "REJECT_LEVEL",
  REQUEST_APPROVAL_CORRECTION: "REQUEST_APPROVAL_CORRECTION",

  RAISE_CORRECTION: "RAISE_CORRECTION",
  COMPLETE_CORRECTION: "COMPLETE_CORRECTION",

  ADD_COST: "ADD_COST",
  VIEW_DESIGN_COSTING: "VIEW_DESIGN_COSTING",

  OPEN_PRODUCTION_TASKS: "OPEN_PRODUCTION_TASKS",
  RETURN_PRODUCTION_HANDOFF: "RETURN_PRODUCTION_HANDOFF",
  RELEASE_PRODUCTION: "RELEASE_PRODUCTION",
  MARK_LIVE: "MARK_LIVE",
} as const;

export type WorkflowActionCode =
  (typeof WORKFLOW_ACTION_CODES)[keyof typeof WORKFLOW_ACTION_CODES];

export type WorkflowActionVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "destructive"
  | "warning";

export type ResolvedWorkflowAction = {
  code: WorkflowActionCode;
  label: string;
  description?: string;
  variant: WorkflowActionVariant;
  enabled: boolean;
  disabledReason?: string;
  href?: string;
  taskId?: string;
  designId?: string;
};

export type WorkflowActionSurface =
  | "design"
  | "task"
  | "approvals"
  | "corrections"
  | "costing"
  | "production";
