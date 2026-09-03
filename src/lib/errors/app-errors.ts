import { permissionDeniedMessage } from "@/lib/user-messages";

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
    "You don't have access for this action. If you think you should, ask your system admin to check your role permissions.",
  VALIDATION_FAILED: "A few fields need fixing before we can save.",
  NOT_FOUND: "We couldn't find that item. It may have been removed or moved.",
  CONCURRENCY_CONFLICT:
    "Someone else updated this just now. Refresh the page, check the latest status, and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Nothing was saved — please try once more.",

  TASK_NOT_FOUND: "That task isn't in the system anymore.",
  TASK_NOT_ASSIGNED: "This task isn't assigned to you.",
  TASK_WRONG_STATUS: "This task can't be changed in its current state.",
  TASK_DEPENDENCY_BLOCKED: "This task is waiting on an earlier stage to finish first.",
  TASK_ALREADY_RUNNING: "You already have a task running. End or hold it before starting another.",
  WORKDAY_CLOSED: "Your workday is closed. You can start task time again on the next workday.",

  REQUIRED_FILE_MISSING: "Please upload the required file before you submit.",
  CHECKLIST_INCOMPLETE: "Please tick all required checklist items before you submit.",
  SAMPLE_OUTCOME_REQUIRED: "Choose Approve, Reject, or Re-sample before submitting.",

  DESIGN_NOT_FOUND: "That design couldn't be found.",
  DESIGN_STATUS_INVALID: "This design can't move to that status right now.",
  WORKFLOW_NOT_READY: "The workflow isn't ready for this step yet.",

  APPROVAL_NOT_ALLOWED: "This approval decision isn't assigned to your role.",
  COSTING_REQUIRED:
    "Enter at least one development cost before completing Costing or final approval.",

  PRODUCTION_RELEASE_BLOCKED: "Production release isn't available for this design yet.",
  PRODUCTION_RELEASE_TASK_REQUIRED:
    "Finish the Production Release task on My Tasks before releasing to production.",

  CORRECTION_INVALID: "We couldn't process this correction. Check the details and try again.",

  WORKFLOW_OVERRIDE_DENIED: "Workflow override isn't enabled for your role on this design.",
  WORKFLOW_TARGET_INVALID: "That phase isn't valid for this workflow action.",
  WORKFLOW_DESIGN_CLOSED: "This design is closed — it can't be moved to another phase.",
  WORKFLOW_BYPASS_BLOCKED: "That phase can't be reached yet because earlier work is still open.",
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
  if (m.includes("costing must be complete") || m.includes("at least one cost"))
    return APP_ERROR_CODES.COSTING_REQUIRED;
  if (status === 404) return APP_ERROR_CODES.NOT_FOUND;
  if (status === 422 && m.includes("validation")) return APP_ERROR_CODES.VALIDATION_FAILED;
  return undefined;
}

export function humanizeClientError(input: {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}): { title: string; hint?: string } {
  const details =
    input.details && typeof input.details === "object"
      ? (input.details as { requiredPermissions?: string[] })
      : undefined;
  const required = details?.requiredPermissions;

  if (input.status === 403 && required?.length) {
    return {
      title: permissionDeniedMessage(required),
      hint: "Sign out and back in after your admin updates your role.",
    };
  }

  const code =
    input.code && input.code in APP_ERROR_MESSAGES
      ? (input.code as AppErrorCode)
      : inferCodeFromMessage(input.message, input.status);

  const title = code ? APP_ERROR_MESSAGES[code] : sanitizeLegacyMessage(input.message, input.status);

  const missingList = Array.isArray(input.details)
    ? (input.details as unknown[]).filter((item): item is string => typeof item === "string")
    : [];

  let hint: string | undefined;
  if (
    code === APP_ERROR_CODES.PRODUCTION_RELEASE_BLOCKED &&
    (missingList.length > 0 || input.message.includes("Missing:"))
  ) {
    hint =
      missingList.length > 0
        ? `Missing:\n• ${missingList.join("\n• ")}`
        : input.message;
  } else if (input.status === 403 && code === APP_ERROR_CODES.PERMISSION_DENIED) {
    hint = "Sign out and back in after your admin updates your role.";
  } else if (input.status === 409 && code === APP_ERROR_CODES.CONCURRENCY_CONFLICT) {
    hint = "Refresh the page and try again.";
  } else if (input.status === 409) {
    hint = "Refresh to load the latest state, then try again.";
  } else if (input.status === 413) {
    hint = "Choose a smaller file within the allowed size limit.";
  } else if (input.status === 404) {
    hint = "Return to the list and open a current record.";
  } else if (input.status === 400 && code === APP_ERROR_CODES.VALIDATION_FAILED) {
    hint = "Check the highlighted fields and try again.";
  } else if (input.status >= 500) {
    hint = "If this keeps happening, share the reference below with support.";
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
