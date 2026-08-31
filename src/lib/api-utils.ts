import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { ZodError, type ZodSchema } from "zod";
import { requirePermission, requireSession } from "./auth";
import type { PermissionCode } from "./permissions";

export type ApiContext = {
  employeeId: number;
  permissions: string[];
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
) {
  return NextResponse.json(
    { error: message, correlationId, details },
    { status },
  );
}

export async function withApiHandler<T>(
  permission: PermissionCode | PermissionCode[] | null,
  handler: (ctx: ApiContext) => Promise<NextResponse>,
) {
  const correlationId = uuidv4();

  try {
    const session = await requireSession();
    if (!session) {
      return jsonError("Not authenticated", 401, correlationId);
    }

    if (
      permission &&
      !requirePermission(session.user.permissions, permission)
    ) {
      return jsonError("Permission denied", 403, correlationId);
    }

    return await handler({
      employeeId: session.user.employeeId,
      permissions: session.user.permissions,
      correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Validation error", 400, correlationId, error.flatten());
    }
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status, correlationId, error.details);
    }
    console.error(JSON.stringify({ correlationId, error: String(error) }));
    return jsonError("Unexpected server error", 500, correlationId);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
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
