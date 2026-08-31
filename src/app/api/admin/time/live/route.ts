import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getLiveTeamTimeStatus } from "@/lib/services/time-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.TIME_VIEW_TEAM, async (ctx) => {
    const data = await getLiveTeamTimeStatus();
    return jsonOk(serializeBigInt(data), ctx.correlationId);
  });
}
