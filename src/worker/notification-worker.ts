import type { Job } from "bullmq";
import { startNotificationWorker, type NotificationJobPayload } from "@/lib/queue";
import { deliverNotification } from "@/lib/services/notification-delivery";
import { prisma } from "@/lib/db";

async function processNotification(job: Job<NotificationJobPayload>) {
  const { eventType, payload, correlationId } = job.data;
  const result = await deliverNotification(eventType, payload);

  await prisma.notificationOutbox.updateMany({
    where: {
      processed: false,
      eventType,
    },
    data: { processed: true, processedAtUtc: new Date() },
  });

  console.log(
    JSON.stringify({
      level: "info",
      eventType,
      correlationId,
      jobId: job.id,
      emailSent: result.emailSent,
      emailTo: result.emailTo,
    }),
  );
}

console.log("Starting Decent ERP notification worker (SMTP + in-app)…");
const worker = startNotificationWorker(processNotification);

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({ level: "error", jobId: job?.id, error: String(err) }));
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
