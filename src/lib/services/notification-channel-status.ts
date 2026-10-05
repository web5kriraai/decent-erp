import { isSmtpConfigured } from "@/lib/email/smtp";
import { isWhatsAppConfigured } from "@/lib/notifications/whatsapp";
import { isPushConfigured } from "@/lib/notifications/push";
import { isNotificationQueueDisabled } from "@/lib/queue";
import { getUploadScanMode } from "@/lib/services/malware-scan";
import { getErpIntegrationMode } from "@/lib/services/erp-integration-config";

export type ChannelStatus = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
};

/** Readiness of outbound notification / integration channels (no secrets). */
export function getNotificationChannelStatus(): {
  channels: ChannelStatus[];
  inAppAlwaysOn: true;
} {
  const redisUrl = !!process.env.REDIS_URL?.trim();
  const queueDisabled = isNotificationQueueDisabled();
  const smtp = isSmtpConfigured();
  const whatsapp = isWhatsAppConfigured();
  const push = isPushConfigured();
  const scanMode = getUploadScanMode();
  const erpMode = getErpIntegrationMode();

  return {
    inAppAlwaysOn: true,
    channels: [
      {
        id: "in_app",
        label: "In-app notifications",
        configured: true,
        detail: "Always on — bell + employee notification inbox",
      },
      {
        id: "queue",
        label: "Notification queue (Redis)",
        configured: redisUrl && !queueDisabled,
        detail: queueDisabled
          ? "NOTIFICATIONS_QUEUE_DISABLED=true — deliveries run inline when enqueued"
          : redisUrl
            ? "REDIS_URL set — start the notification worker for async delivery + due/ERP scanners"
            : "REDIS_URL unset — set it and run the worker for email/WhatsApp/push and scheduled jobs",
      },
      {
        id: "email",
        label: "Email (SMTP)",
        configured: smtp,
        detail: smtp
          ? "SMTP_HOST + SMTP_FROM configured"
          : "Set SMTP_HOST and SMTP_FROM (optional USER/PASS/NOTIFY_EMAIL)",
      },
      {
        id: "whatsapp",
        label: "WhatsApp webhook",
        configured: whatsapp,
        detail: whatsapp
          ? "WHATSAPP_WEBHOOK_URL configured"
          : "Set WHATSAPP_WEBHOOK_URL (+ optional API_KEY / NOTIFY_EVENTS)",
      },
      {
        id: "push",
        label: "Push webhook",
        configured: push,
        detail: push
          ? "PUSH_WEBHOOK_URL configured"
          : "Set PUSH_WEBHOOK_URL (+ optional API_KEY / NOTIFY_EVENTS)",
      },
      {
        id: "upload_scan",
        label: "Upload malware scan",
        configured: scanMode === "clamav" ? !!process.env.CLAMAV_HOST?.trim() : true,
        detail:
          scanMode === "clamav"
            ? process.env.CLAMAV_HOST?.trim()
              ? `Mode clamav · host ${process.env.CLAMAV_HOST.trim()}`
              : "Mode clamav but CLAMAV_HOST is missing"
            : `Mode ${scanMode} (set UPLOAD_SCAN_MODE=clamav + CLAMAV_HOST for deep scan)`,
      },
      {
        id: "erp",
        label: "Partner ERP",
        configured: erpMode === "live",
        detail:
          erpMode === "live"
            ? "ERP_API_BASE_URL set — live handoff + design-success ingest"
            : "Simulated — set ERP_API_BASE_URL (+ optional ERP_API_KEY) for live partner sync",
      },
    ],
  };
}
