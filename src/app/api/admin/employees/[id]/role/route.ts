import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateEmployeeRole } from "@/lib/services/role-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  roleCode: z.string().min(1),
});

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
    const body = await parseBody(request, schema);
    const employee = await updateEmployeeRole(parseEmployeeId(id), body.roleCode, ctx.employeeId);
    return jsonOk(employee, ctx.correlationId);
  });
}
