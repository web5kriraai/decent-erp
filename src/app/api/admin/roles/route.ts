import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { listRolesForAdmin } from "@/lib/services/role-admin-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const roles = await listRolesForAdmin();
    return jsonOk(roles, ctx.correlationId);
  });
}
