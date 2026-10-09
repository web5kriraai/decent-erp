import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { enqueueNotification, isNotificationQueueDisabled } from "./queue";
import { deliverNotification } from "@/lib/services/notification-delivery";
import { publishRealtime, topicsForEventType } from "@/lib/realtime";

/**
 * Persist an outbox row and write the in-app bell immediately.
 * Email, WhatsApp, and push still go through the queue when it is enabled.
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
  await publishOutboxRealtime(eventType, payload);

  const queueOn = !isNotificationQueueDisabled();
  try {
    await deliverNotification(eventType, payload, { skipExternal: queueOn });
    await prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: { processed: true, processedAtUtc: new Date() },
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "In-app notification delivery failed; outbox row retained",
        eventType,
        outboxId,
        error: String(error),
      }),
    );
  }

  if (!queueOn) return;

  try {
    await enqueueNotification({
      eventType,
      payload,
      correlationId,
      outboxId,
      skipInApp: true,
    });
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

async function resolveRealtimeCompanyId(payload: Record<string, unknown>) {
  if (typeof payload.companyId === "number" && payload.companyId > 0) {
    return payload.companyId;
  }
  if (typeof payload.designId === "string" && /^\d+$/.test(payload.designId)) {
    const design = await prisma.designConcept.findUnique({
      where: { id: BigInt(payload.designId) },
      select: { companyId: true },
    });
    if (design) return design.companyId;
  }
  if (typeof payload.taskId === "string" && /^\d+$/.test(payload.taskId)) {
    const task = await prisma.designTask.findUnique({
      where: { id: BigInt(payload.taskId) },
      select: { design: { select: { companyId: true } } },
    });
    if (task) return task.design.companyId;
  }
  const employeeId =
    typeof payload.employeeId === "number"
      ? payload.employeeId
      : typeof payload.responsibleEmployeeId === "number"
        ? payload.responsibleEmployeeId
        : typeof payload.designHeadId === "number"
          ? payload.designHeadId
          : null;
  if (employeeId != null) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    return employee?.companyId ?? null;
  }
  return null;
}

async function publishOutboxRealtime(eventType: string, payload: Record<string, unknown>) {
  try {
    const companyId = await resolveRealtimeCompanyId(payload);
    if (!companyId) return;
    await publishRealtime({ companyId, topics: topicsForEventType(eventType) });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Realtime publish skipped",
        eventType,
        error: String(error),
      }),
    );
  }
}
