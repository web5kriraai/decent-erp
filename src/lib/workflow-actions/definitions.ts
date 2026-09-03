import {
  WORKFLOW_ACTION_CODES,
  type WorkflowActionCode,
  type WorkflowActionVariant,
} from "@/lib/workflow-actions/types";

export const WORKFLOW_ACTION_META: Record<
  WorkflowActionCode,
  { label: string; variant: WorkflowActionVariant; description?: string }
> = {
  [WORKFLOW_ACTION_CODES.OPEN_TASK]: {
    label: "Open task",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.REQUEST_APPROVAL]: {
    label: "Request Management Sign-off",
    variant: "primary",
    description: "Send the design into the management approval chain (Design Head only).",
  },
  [WORKFLOW_ACTION_CODES.OPEN_APPROVALS_QUEUE]: {
    label: "Open Approvals Queue",
    variant: "primary",
    description: "Review and record your approval decision.",
  },
  [WORKFLOW_ACTION_CODES.ASSIGN_TASK]: {
    label: "Assign task",
    variant: "outline",
  },
  [WORKFLOW_ACTION_CODES.START_TASK]: {
    label: "Start Task",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.HOLD_TASK]: {
    label: "Hold Task",
    variant: "outline",
  },
  [WORKFLOW_ACTION_CODES.RESUME_TASK]: {
    label: "Resume Task",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.END_TASK]: {
    label: "Complete Task",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.APPROVE_LEVEL]: {
    label: "Approve",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.REJECT_LEVEL]: {
    label: "Reject",
    variant: "destructive",
  },
  [WORKFLOW_ACTION_CODES.REQUEST_APPROVAL_CORRECTION]: {
    label: "Send for Correction",
    variant: "warning",
  },
  [WORKFLOW_ACTION_CODES.RAISE_CORRECTION]: {
    label: "Raise Correction",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.COMPLETE_CORRECTION]: {
    label: "Mark Correction Done",
    variant: "primary",
  },
  [WORKFLOW_ACTION_CODES.ADD_COST]: {
    label: "Add Cost Entry",
    variant: "primary",
    description: "Record development, material, machine, or correction cost.",
  },
  [WORKFLOW_ACTION_CODES.VIEW_DESIGN_COSTING]: {
    label: "View design costing",
    variant: "outline",
  },
  [WORKFLOW_ACTION_CODES.OPEN_PRODUCTION_TASKS]: {
    label: "Open My Action Center",
    variant: "primary",
    description: "Complete production instruction and release tasks.",
  },
  [WORKFLOW_ACTION_CODES.RETURN_PRODUCTION_HANDOFF]: {
    label: "Return for Clarification",
    variant: "destructive",
    description: "Route a correction without erasing completed history.",
  },
  [WORKFLOW_ACTION_CODES.RELEASE_PRODUCTION]: {
    label: "Production Release",
    variant: "primary",
    description: "Complete the Production Release task on My Tasks.",
  },
  [WORKFLOW_ACTION_CODES.MARK_LIVE]: {
    label: "Mark Live",
    variant: "primary",
  },
};

export function actionMeta(code: WorkflowActionCode) {
  return WORKFLOW_ACTION_META[code];
}
