import { prisma } from "@/lib/db";
import { sendEmail, isSmtpConfigured } from "@/lib/email/smtp";
import { buildNotificationMessage } from "@/lib/notifications/messages";

export async function deliverNotification(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ inApp: boolean; emailSent: boolean; emailTo?: string }> {
  const { subject, text, html } = buildNotificationMessage(eventType, payload);

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

  const employeeId =
    typeof payload.employeeId === "number"
      ? payload.employeeId
      : typeof payload.responsibleEmployeeId === "number"
        ? payload.responsibleEmployeeId
        : null;

  if (employeeId && isSmtpConfigured()) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
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

  return { inApp: true, emailSent, emailTo };
}
