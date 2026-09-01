/**
 * Application error codes — safe to expose to clients.
 * Technical details go in server logs only (via correlationId).
 */
export const APP_ERROR_CODES = {
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  CONCURRENCY_CONFLICT: "CONCURRENCY_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  TASK_NOT_ASSIGNED: "TASK_NOT_ASSIGNED",
  TASK_WRONG_STATUS: "TASK_WRONG_STATUS",
  TASK_DEPENDENCY_BLOCKED: "TASK_DEPENDENCY_BLOCKED",
  TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING",
  WORKDAY_CLOSED: "WORKDAY_CLOSED",

  REQUIRED_FILE_MISSING: "REQUIRED_FILE_MISSING",
  CHECKLIST_INCOMPLETE: "CHECKLIST_INCOMPLETE",
  SAMPLE_OUTCOME_REQUIRED: "SAMPLE_OUTCOME_REQUIRED",

  DESIGN_NOT_FOUND: "DESIGN_NOT_FOUND",
  DESIGN_STATUS_INVALID: "DESIGN_STATUS_INVALID",
  WORKFLOW_NOT_READY: "WORKFLOW_NOT_READY",

  APPROVAL_NOT_ALLOWED: "APPROVAL_NOT_ALLOWED",
  COSTING_REQUIRED: "COSTING_REQUIRED",

  PRODUCTION_RELEASE_BLOCKED: "PRODUCTION_RELEASE_BLOCKED",
  PRODUCTION_RELEASE_TASK_REQUIRED: "PRODUCTION_RELEASE_TASK_REQUIRED",

  CORRECTION_INVALID: "CORRECTION_INVALID",

  WORKFLOW_OVERRIDE_DENIED: "WORKFLOW_OVERRIDE_DENIED",
  WORKFLOW_TARGET_INVALID: "WORKFLOW_TARGET_INVALID",
  WORKFLOW_DESIGN_CLOSED: "WORKFLOW_DESIGN_CLOSED",
  WORKFLOW_BYPASS_BLOCKED: "WORKFLOW_BYPASS_BLOCKED",
} as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];

export const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NOT_AUTHENTICATED: "Please sign in to continue.",
  PERMISSION_DENIED:
    "You do not have permission to perform this action. Contact your administrator if this seems incorrect.",
  VALIDATION_FAILED: "Some fields need correction before you can continue.",
  NOT_FOUND: "The requested item could not be found. It may have been removed.",
  CONCURRENCY_CONFLICT:
    "This item was updated by someone else. Refresh the page to see the latest status, then try again.",
  INTERNAL_ERROR:
    "We couldn't complete this action right now. Your changes were not saved. Please try again.",

  TASK_NOT_FOUND: "This task could not be found.",
  TASK_NOT_ASSIGNED: "This task is not assigned to you.",
  TASK_WRONG_STATUS: "This task cannot be updated in its current status.",
  TASK_DEPENDENCY_BLOCKED:
    "This task cannot start yet because a prior stage must be completed first.",
  TASK_ALREADY_RUNNING: "You already have another task running. End or hold it before starting a new one.",
  WORKDAY_CLOSED: "Your workday is closed. You cannot start new task time until the next workday.",

  REQUIRED_FILE_MISSING: "Please upload the required file before submitting.",
  CHECKLIST_INCOMPLETE: "Please complete all required checklist items before submitting.",
  SAMPLE_OUTCOME_REQUIRED: "Please choose Approve, Reject, or Re-sample before submitting.",

  DESIGN_NOT_FOUND: "This design could not be found.",
  DESIGN_STATUS_INVALID: "This design cannot move to the requested status right now.",
  WORKFLOW_NOT_READY: "The workflow is not ready for this action yet.",

  APPROVAL_NOT_ALLOWED: "You are not authorized to record this approval decision.",
  COSTING_REQUIRED: "Development costing must be complete before this approval can be recorded.",

  PRODUCTION_RELEASE_BLOCKED: "Production release is not available yet.",
  PRODUCTION_RELEASE_TASK_REQUIRED:
    "Complete the Production Release task on My Tasks before releasing to production.",

  CORRECTION_INVALID: "This correction could not be processed. Check the details and try again.",

  WORKFLOW_OVERRIDE_DENIED: "You do not have permission to override the workflow for this design.",
  WORKFLOW_TARGET_INVALID: "The selected phase is not valid for this workflow action.",
  WORKFLOW_DESIGN_CLOSED: "This design is closed and cannot be moved to another phase.",
  WORKFLOW_BYPASS_BLOCKED: "This phase cannot be reached yet because required prior work is still missing.",
};

export function messageForCode(code: AppErrorCode): string {
  return APP_ERROR_MESSAGES[code];
}

/** Map legacy / raw server messages to codes when code is missing. */
export function inferCodeFromMessage(message: string, status: number): AppErrorCode | undefined {
  const m = message.toLowerCase();
  if (status === 401) return APP_ERROR_CODES.NOT_AUTHENTICATED;
  if (status === 403) return APP_ERROR_CODES.PERMISSION_DENIED;
  if (status === 409 && m.includes("concurrency")) return APP_ERROR_CODES.CONCURRENCY_CONFLICT;
  if (status === 409 && m.includes("already running")) return APP_ERROR_CODES.TASK_ALREADY_RUNNING;
  if (status === 409 && m.includes("workday")) return APP_ERROR_CODES.WORKDAY_CLOSED;
  if (m.includes("cannot start") && m.includes("prior")) return APP_ERROR_CODES.TASK_DEPENDENCY_BLOCKED;
  if (m.includes("upload") && m.includes("file")) return APP_ERROR_CODES.REQUIRED_FILE_MISSING;
  if (m.includes("production release is not available")) return APP_ERROR_CODES.PRODUCTION_RELEASE_BLOCKED;
  if (m.includes("costing must be complete")) return APP_ERROR_CODES.COSTING_REQUIRED;
  if (status === 404) return APP_ERROR_CODES.NOT_FOUND;
  if (status === 422 && m.includes("validation")) return APP_ERROR_CODES.VALIDATION_FAILED;
  return undefined;
}

export function humanizeClientError(input: {
  message: string;
  status: number;
  code?: string;
}): { title: string; hint?: string } {
  const code =
    input.code && input.code in APP_ERROR_MESSAGES
      ? (input.code as AppErrorCode)
      : inferCodeFromMessage(input.message, input.status);

  const title = code ? APP_ERROR_MESSAGES[code] : sanitizeLegacyMessage(input.message, input.status);

  let hint: string | undefined;
  if (input.status === 409 && code === APP_ERROR_CODES.CONCURRENCY_CONFLICT) {
    hint = "Refresh the page and try again.";
  } else if (input.status === 400 && code === APP_ERROR_CODES.VALIDATION_FAILED) {
    hint = "Check the highlighted fields and try again.";
  } else if (input.status >= 500) {
    hint = "If this keeps happening, contact support with the reference below.";
  }

  return { title, hint };
}

/** Never show raw stack traces, Prisma, or framework errors to users. */
export function sanitizeLegacyMessage(message: string, status: number): string {
  const technical =
    /prisma|typeerror|undefined|axios|unhandled|exception|stack|ECONNREFUSED|P\d{4}/i.test(
      message,
    );
  if (technical || !message.trim()) {
    if (status === 403) return APP_ERROR_MESSAGES.PERMISSION_DENIED;
    if (status === 401) return APP_ERROR_MESSAGES.NOT_AUTHENTICATED;
    if (status === 404) return APP_ERROR_MESSAGES.NOT_FOUND;
    if (status >= 500) return APP_ERROR_MESSAGES.INTERNAL_ERROR;
    return "We couldn't complete this action. Please try again.";
  }
  return message;
}

export function formatZodFieldSummary(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const flat = details as { fieldErrors?: Record<string, string[]> };
  const entries = Object.entries(flat.fieldErrors ?? {});
  if (entries.length === 0) return undefined;
  const first = entries[0];
  const field = first[0].replace(/([A-Z])/g, " $1").trim();
  const msg = first[1]?.[0];
  if (!msg) return `Please check ${field}.`;
  return `Please check ${field}: ${msg}`;
}
