import { prisma } from "@/lib/db";
import { sendEmail, isSmtpConfigured } from "@/lib/email/smtp";
import { buildNotificationMessage } from "@/lib/notifications/messages";
import { createEmployeeNotification } from "@/lib/services/employee-notification-service";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

export async function deliverNotification(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ inApp: boolean; emailSent: boolean; emailTo?: string; whatsAppSent: boolean }> {
  const { subject, text, html } = buildNotificationMessage(eventType, payload);

  let inApp = false;

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
  if (isWhatsAppConfigured() && process.env.WHATSAPP_NOTIFY_EVENTS?.split(",").includes(eventType)) {
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

  return { inApp: inApp || true, emailSent, emailTo, whatsAppSent };
}
