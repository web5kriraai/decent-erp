import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { ZodError, type ZodSchema } from "zod";
import { permissionDeniedMessage } from "@/lib/user-messages";
import {
  APP_ERROR_CODES,
  formatZodFieldSummary,
  messageForCode,
} from "@/lib/errors/app-errors";
import { requirePermission, requireSession } from "./auth";
import { loadEmployeeSessionPermissions } from "./session-permissions";
import type { PermissionCode } from "./permissions";

export type ApiContext = {
  employeeId: number;
  permissions: string[];
  roleCode: string;
  correlationId: string;
};

export function jsonOk<T>(data: T, correlationId: string, status = 200) {
  return NextResponse.json({ data, correlationId }, { status });
}

export function jsonError(
  message: string,
  status: number,
  correlationId: string,
  details?: unknown,
  code?: string,
) {
  return NextResponse.json(
    { error: message, code, correlationId, details },
    { status },
  );
}

export async function withApiHandler(
  permission: PermissionCode | PermissionCode[] | null,
  handler: (ctx: ApiContext) => Promise<NextResponse>,
) {
  const correlationId = uuidv4();

  try {
    const session = await requireSession();
    if (!session) {
      return jsonError(
        messageForCode(APP_ERROR_CODES.NOT_AUTHENTICATED),
        401,
        correlationId,
        undefined,
        APP_ERROR_CODES.NOT_AUTHENTICATED,
      );
    }

    const fresh = await loadEmployeeSessionPermissions(session.user.employeeId);
    const permissions = fresh.permissions.length > 0 ? fresh.permissions : session.user.permissions;
    const roleCode = fresh.roleCode ?? session.user.roleCode;

    if (permission && !requirePermission(permissions, permission)) {
      const requiredList = Array.isArray(permission) ? permission : [permission];
      return jsonError(
        permissionDeniedMessage(requiredList),
        403,
        correlationId,
        { requiredPermissions: requiredList },
        APP_ERROR_CODES.PERMISSION_DENIED,
      );
    }

    return await handler({
      employeeId: session.user.employeeId,
      permissions,
      roleCode,
      correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const fieldSummary = formatZodFieldSummary(flattened);
      return jsonError(
        fieldSummary ?? messageForCode(APP_ERROR_CODES.VALIDATION_FAILED),
        400,
        correlationId,
        flattened,
        APP_ERROR_CODES.VALIDATION_FAILED,
      );
    }
    if (error instanceof ApiError) {
      return jsonError(
        error.message,
        error.status,
        correlationId,
        error.details,
        error.code,
      );
    }
    console.error(
      JSON.stringify({
        correlationId,
        error: formatErrorMessage(error),
      }),
    );
    return jsonError(
      messageForCode(APP_ERROR_CODES.INTERNAL_ERROR),
      500,
      correlationId,
      undefined,
      APP_ERROR_CODES.INTERNAL_ERROR,
    );
  }
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    const nested = error.errors.map(formatErrorMessage).filter(Boolean);
    return nested.length > 0 ? nested.join("; ") : error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val,
    ),
  ) as T;
}
