import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getProcessMasters } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const processes = await getProcessMasters();
    return jsonOk(serializeBigInt(processes), ctx.correlationId);
  });
}
