import type { Job } from "bullmq";
import {
  ensureAuditArchiveSchedule,
  ensureDesignSuccessErpScanSchedule,
  ensureTaskDueScanSchedule,
  SCAN_AUDIT_ARCHIVE_EVENT,
  SCAN_DESIGN_SUCCESS_ERP_EVENT,
  SCAN_TASK_DUES_EVENT,
  startNotificationWorker,
  type NotificationJobPayload,
} from "@/lib/queue";
import { deliverNotification } from "@/lib/services/notification-delivery";
import { scanAndNotifyTaskDues } from "@/lib/services/task-due-notification-service";
import { archiveAuditLogsOlderThan } from "@/lib/services/audit-archive-service";
import { batchSyncDesignSuccessFromErp } from "@/lib/services/design-success-batch-sync";
import { prisma } from "@/lib/db";

async function processNotification(job: Job<NotificationJobPayload>) {
  const { eventType, payload, correlationId, outboxId } = job.data;

  if (eventType === SCAN_TASK_DUES_EVENT) {
    const result = await scanAndNotifyTaskDues(correlationId ?? `scan-${job.id}`);
    console.log(
      JSON.stringify({
        level: "info",
        eventType,
        jobId: job.id,
        ...result,
      }),
    );
    return;
  }

  if (eventType === SCAN_AUDIT_ARCHIVE_EVENT) {
    const result = await archiveAuditLogsOlderThan();
    console.log(
      JSON.stringify({
        level: "info",
        eventType,
        jobId: job.id,
        ...result,
      }),
    );
    return;
  }

  if (eventType === SCAN_DESIGN_SUCCESS_ERP_EVENT) {
    const result = await batchSyncDesignSuccessFromErp();
    console.log(
      JSON.stringify({
        level: "info",
        eventType,
        jobId: job.id,
        ...result,
      }),
    );
    return;
  }

  const result = await deliverNotification(eventType, payload);

  if (outboxId) {
    await prisma.notificationOutbox.updateMany({
      where: { id: BigInt(outboxId), processed: false },
      data: { processed: true, processedAtUtc: new Date() },
    });
  } else {
    const row = await prisma.notificationOutbox.findFirst({
      where: { processed: false, eventType },
      orderBy: { id: "asc" },
    });
    if (row) {
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { processed: true, processedAtUtc: new Date() },
      });
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      eventType,
      correlationId,
      outboxId,
      jobId: job.id,
      emailSent: result.emailSent,
      emailTo: result.emailTo,
      whatsAppSent: result.whatsAppSent,
      pushSent: result.pushSent,
    }),
  );
}

console.log("Starting Decent ERP notification worker (email + WhatsApp + push + in-app)…");
void ensureTaskDueScanSchedule().then(() => {
  console.log("Registered SCAN_TASK_DUES repeatable job (every 15m)");
});
void ensureAuditArchiveSchedule().then(() => {
  console.log("Registered SCAN_AUDIT_ARCHIVE repeatable job (daily)");
});
void ensureDesignSuccessErpScanSchedule().then(() => {
  console.log("Registered SCAN_DESIGN_SUCCESS_ERP repeatable job (hourly)");
});
const worker = startNotificationWorker(processNotification);

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({ level: "error", jobId: job?.id, error: String(err) }));
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
