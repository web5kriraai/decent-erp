import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { enqueueNotification, isNotificationQueueDisabled } from "./queue";
import { deliverNotification } from "@/lib/services/notification-delivery";

/**
 * Persist an outbox row, then deliver via the queue (or sync when queue is off).
 * In-app / email / WhatsApp / push are created only in deliverNotification — not here —
 * so workers do not double-create employee notifications.
 */
export async function enqueueOutboxAndNotify(
  eventType: string,
  payload: Record<string, unknown>,
  correlationId?: string,
) {
  const outbox = await prisma.notificationOutbox.create({
    data: {
      eventType,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  const outboxId = outbox.id.toString();

  if (isNotificationQueueDisabled()) {
    try {
      await deliverNotification(eventType, payload);
      await prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: { processed: true, processedAtUtc: new Date() },
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "Sync notification delivery failed; outbox row retained",
          eventType,
          outboxId,
          error: String(error),
        }),
      );
    }
    return;
  }

  try {
    await enqueueNotification({ eventType, payload, correlationId, outboxId });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Notification queue unavailable; outbox row retained",
        eventType,
        outboxId,
        error: String(error),
      }),
    );
  }
}
