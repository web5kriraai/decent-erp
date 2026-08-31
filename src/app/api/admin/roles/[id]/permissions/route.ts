import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getRolePermissionMatrix,
  updateRolePermissions,
} from "@/lib/services/role-admin-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const matrix = await getRolePermissionMatrix(Number(id));
    return jsonOk(matrix, ctx.correlationId);
  });
}

const patchSchema = z.object({
  permissionCodes: z.array(z.string().min(1)),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const matrix = await updateRolePermissions(
      Number(id),
      body.permissionCodes,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(matrix, ctx.correlationId);
  });
}
