import { startNotificationWorker, type NotificationJobPayload } from "@/lib/queue";
import type { Job } from "bullmq";

async function processNotification(job: Job<NotificationJobPayload>) {
  const { eventType, payload, correlationId } = job.data;

  console.log(
    JSON.stringify({
      level: "info",
      msg: "Notification processed",
      eventType,
      payload,
      correlationId,
      jobId: job.id,
    }),
  );
}

console.log("Starting Decent ERP notification worker…");
const worker = startNotificationWorker(processNotification);

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({ level: "error", jobId: job?.id, error: String(err) }));
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
