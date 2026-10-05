import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getNotificationChannelStatus } from "@/lib/services/notification-channel-status";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    return jsonOk(getNotificationChannelStatus(), ctx.correlationId);
  });
}
