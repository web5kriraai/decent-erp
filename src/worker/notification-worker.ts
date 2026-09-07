import type { Job } from "bullmq";
import { startNotificationWorker, type NotificationJobPayload } from "@/lib/queue";
import { deliverNotification } from "@/lib/services/notification-delivery";
import { prisma } from "@/lib/db";

async function processNotification(job: Job<NotificationJobPayload>) {
  const { eventType, payload, correlationId, outboxId } = job.data;
  const result = await deliverNotification(eventType, payload);

  if (outboxId) {
    await prisma.notificationOutbox.updateMany({
      where: { id: BigInt(outboxId), processed: false },
      data: { processed: true, processedAtUtc: new Date() },
    });
  } else {
    // Legacy jobs without outboxId: mark one oldest matching unprocessed row.
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
const worker = startNotificationWorker(processNotification);

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({ level: "error", jobId: job?.id, error: String(err) }));
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
