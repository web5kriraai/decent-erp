import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getFullRbacMatrix } from "@/lib/services/role-admin-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const matrix = await getFullRbacMatrix();
    return jsonOk(serializeBigInt(matrix), ctx.correlationId);
  });
}
