import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import {
  countUnreadNotifications,
  listEmployeeNotifications,
  markAllNotificationsRead,
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

const patchSchema = z
  .object({
    notificationId: z.string().optional(),
    all: z.boolean().optional(),
  })
  .refine((body) => body.all === true || Boolean(body.notificationId), {
    message: "Choose one notification or mark all as read",
  });

export async function PATCH(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const body = await parseBody(request, patchSchema);
    if (body.all) {
      const updated = await markAllNotificationsRead(ctx.employeeId);
      return jsonOk(updated, ctx.correlationId);
    }
    const updated = await markNotificationRead(BigInt(body.notificationId!), ctx.employeeId);
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
