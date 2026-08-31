import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { suggestNextEmployeeCode } from "@/lib/services/role-admin-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const code = await suggestNextEmployeeCode();
    return jsonOk({ employeeCode: code }, ctx.correlationId);
  });
}
