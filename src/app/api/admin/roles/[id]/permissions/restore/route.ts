import { ApiError, jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { restoreRolePermissionsToDefaults } from "@/lib/services/role-admin-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const roleId = Number.parseInt(id, 10);

  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    if (!Number.isFinite(roleId)) {
      throw new ApiError("Invalid role id", 400);
    }

    const matrix = await restoreRolePermissionsToDefaults(
      roleId,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(matrix), ctx.correlationId);
  });
}
