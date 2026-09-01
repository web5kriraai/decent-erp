import { ApiError } from "@/lib/api-utils";
import {
  APP_ERROR_CODES,
  type AppErrorCode,
  messageForCode,
} from "@/lib/errors/app-errors";

export function createAppError(
  code: AppErrorCode,
  status: number,
  details?: unknown,
  messageOverride?: string,
): ApiError {
  return new ApiError(messageOverride ?? messageForCode(code), status, details, code);
}

export function notFound(code: AppErrorCode = APP_ERROR_CODES.NOT_FOUND): ApiError {
  return createAppError(code, 404);
}

export function forbidden(): ApiError {
  return createAppError(APP_ERROR_CODES.PERMISSION_DENIED, 403);
}

export function conflict(code: AppErrorCode, details?: unknown, message?: string): ApiError {
  return createAppError(code, 409, details, message);
}

export function businessRule(
  code: AppErrorCode,
  details?: unknown,
  message?: string,
): ApiError {
  return createAppError(code, 422, details, message);
}
