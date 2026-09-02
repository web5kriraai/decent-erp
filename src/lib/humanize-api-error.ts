import { ApiClientError } from "@/lib/api-client";
import {
  formatZodFieldSummary,
  humanizeClientError,
} from "@/lib/errors/app-errors";

export type HumanizedApiError = {
  title: string;
  hint?: string;
  correlationId?: string;
};

export function humanizeApiError(error: unknown, fallback = "Something went wrong"): HumanizedApiError {
  if (error instanceof ApiClientError) {
    const { title, hint } = humanizeClientError({
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
    });
    const fieldSummary = error.isValidationError ? formatZodFieldSummary(error.details) : undefined;
    return {
      title: fieldSummary ?? title ?? fallback,
      hint: hint ?? (error.isConflict ? "Refresh the page and try again." : undefined),
      correlationId: error.correlationId,
    };
  }

  if (error instanceof Error && error.message) {
    const { title } = humanizeClientError({ message: error.message, status: 500 });
    return { title: title === error.message ? fallback : title };
  }

  return { title: fallback };
}
