import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { enqueueNotification } from "./queue";
import { createEmployeeNotification } from "@/lib/services/employee-notification-service";

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

  const employeeId =
    typeof payload.employeeId === "number"
      ? payload.employeeId
      : typeof payload.responsibleEmployeeId === "number"
        ? payload.responsibleEmployeeId
        : typeof payload.designHeadId === "number"
          ? payload.designHeadId
          : null;

  if (employeeId != null) {
    try {
      await createEmployeeNotification(employeeId, eventType, payload);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "In-app notification persist failed",
          eventType,
          error: String(error),
        }),
      );
    }
  }

  try {
    await enqueueNotification({ eventType, payload, correlationId });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Notification queue unavailable; outbox row retained",
        eventType,
        error: String(error),
      }),
    );
  }
}
