import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateEmployee } from "@/lib/services/role-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().optional(),
    roleCode: z.string().min(1).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.roleCode !== undefined ||
      body.active !== undefined ||
      body.password !== undefined,
    { message: "At least one field is required" },
  );

function parseEmployeeId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError("Invalid employee id", 400);
  }
  return id;
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const body = await parseBody(request, updateSchema);
    const employee = await updateEmployee(parseEmployeeId(id), body, ctx.employeeId);
    return jsonOk(employee, ctx.correlationId);
  });
}
