import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getActionCenter } from "@/lib/services/action-center-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const center = await getActionCenter(ctx.employeeId);
    return jsonOk(serializeBigInt(center), ctx.correlationId);
  });
}
