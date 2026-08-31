import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const transport = getTransporter();
  if (!transport) {
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text,
  });

  return { sent: true };
}
