import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { enqueueNotification } from "./queue";

export async function enqueueOutboxAndNotify(
  eventType: string,
  payload: Record<string, unknown>,
  correlationId?: string,
) {
  await prisma.notificationOutbox.create({
    data: {
      eventType,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  await enqueueNotification({ eventType, payload, correlationId });
}
