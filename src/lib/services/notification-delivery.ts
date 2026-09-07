import { prisma } from "@/lib/db";
import { sendEmail, isSmtpConfigured } from "@/lib/email/smtp";
import { buildNotificationMessage } from "@/lib/notifications/messages";
import { createEmployeeNotification } from "@/lib/services/employee-notification-service";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { isPushConfigured, sendPushNotification } from "@/lib/notifications/push";

function eventAllowed(envKey: string, eventType: string): boolean {
  const raw = process.env[envKey]?.trim();
  if (!raw) return true; // no allow-list → all events
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(eventType);
}

function resolveEmployeeId(payload: Record<string, unknown>): number | null {
  if (typeof payload.employeeId === "number") return payload.employeeId;
  if (typeof payload.responsibleEmployeeId === "number") return payload.responsibleEmployeeId;
  if (typeof payload.designHeadId === "number") return payload.designHeadId;
  return null;
}

export async function deliverNotification(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{
  inApp: boolean;
  emailSent: boolean;
  emailTo?: string;
  whatsAppSent: boolean;
  pushSent: boolean;
}> {
  const { subject, text, html } = buildNotificationMessage(eventType, payload);

  let inApp = false;
  const employeeId = resolveEmployeeId(payload);

  if (employeeId != null) {
    try {
      await createEmployeeNotification(employeeId, eventType, payload);
      inApp = true;
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "Failed to persist in-app notification",
          eventType,
          employeeId,
          error: String(error),
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      channel: "in-app",
      msg: text,
      eventType,
      payload,
      deliveredAt: new Date().toISOString(),
    }),
  );

  let emailSent = false;
  let emailTo: string | undefined;

  const notifyEmployeeId =
    typeof payload.employeeId === "number"
      ? payload.employeeId
      : typeof payload.responsibleEmployeeId === "number"
        ? payload.responsibleEmployeeId
        : null;

  if (notifyEmployeeId && isSmtpConfigured()) {
    const employee = await prisma.employee.findUnique({
      where: { id: notifyEmployeeId },
      select: { email: true, active: true },
    });
    if (employee?.active && employee.email) {
      const result = await sendEmail({ to: employee.email, subject, text, html });
      emailSent = result.sent;
      emailTo = employee.email;
    }
  } else if (isSmtpConfigured() && process.env.SMTP_NOTIFY_EMAIL) {
    const result = await sendEmail({
      to: process.env.SMTP_NOTIFY_EMAIL,
      subject,
      text,
      html,
    });
    emailSent = result.sent;
    emailTo = process.env.SMTP_NOTIFY_EMAIL;
  }

  let whatsAppSent = false;
  if (isWhatsAppConfigured() && eventAllowed("WHATSAPP_NOTIFY_EVENTS", eventType)) {
    const result = await sendWhatsAppMessage(`${subject}\n\n${text}`, payload);
    whatsAppSent = result.sent;
    if (!result.sent && result.reason) {
      console.warn(
        JSON.stringify({
          level: "warn",
          channel: "whatsapp",
          eventType,
          reason: result.reason,
        }),
      );
    }
  }

  let pushSent = false;
  if (isPushConfigured() && eventAllowed("PUSH_NOTIFY_EVENTS", eventType)) {
    const result = await sendPushNotification(subject, text, { eventType, ...payload });
    pushSent = result.sent;
    if (!result.sent && result.reason) {
      console.warn(
        JSON.stringify({
          level: "warn",
          channel: "push",
          eventType,
          reason: result.reason,
        }),
      );
    }
  }

  return { inApp, emailSent, emailTo, whatsAppSent, pushSent };
}
