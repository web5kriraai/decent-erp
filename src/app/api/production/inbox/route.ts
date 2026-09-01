import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getProductionHeadInbox } from "@/lib/services/production-inbox-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const inbox = await getProductionHeadInbox(ctx.employeeId);
    return jsonOk(serializeBigInt(inbox), ctx.correlationId);
  });
}
