import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import {
  countUnreadNotifications,
  listEmployeeNotifications,
  markNotificationRead,
} from "@/lib/services/employee-notification-service";
import { z } from "zod";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const [items, unreadCount] = await Promise.all([
      listEmployeeNotifications(ctx.employeeId, 25),
      countUnreadNotifications(ctx.employeeId),
    ]);
    return jsonOk(
      {
        items: serializeBigInt(items),
        unreadCount,
      },
      ctx.correlationId,
    );
  });
}

const patchSchema = z.object({
  notificationId: z.string(),
});

export async function PATCH(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const body = await parseBody(request, patchSchema);
    const updated = await markNotificationRead(BigInt(body.notificationId), ctx.employeeId);
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
