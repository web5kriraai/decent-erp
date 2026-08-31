import type { Job } from "bullmq";
import { startNotificationWorker, type NotificationJobPayload } from "@/lib/queue";

const HANDLERS: Record<string, (payload: Record<string, unknown>) => string> = {
  TASK_ASSIGNED: (p) => `Task ${p.taskId} assigned to employee ${p.employeeId}`,
  CORRECTION_RAISED: (p) => `Correction ${p.correctionId} raised for design ${p.designId}`,
  PRODUCTION_RELEASED: (p) => `Design ${p.designNumber ?? p.designId} released to production`,
  TASK_COMPLETED: (p) => `Task ${p.taskId} completed on design ${p.designId}`,
  DESIGN_CREATED: (p) => `New design ${p.designId} created`,
  TASK_DUE_SOON: (p) => `Task ${p.taskId} due within ${p.hours} hours`,
  TASK_OVERDUE: (p) => `Task ${p.taskId} is overdue`,
  APPROVAL_PENDING: (p) => `Approval pending for design ${p.designId}`,
};

async function processNotification(job: Job<NotificationJobPayload>) {
  const { eventType, payload, correlationId } = job.data;
  const message = HANDLERS[eventType]?.(payload) ?? `Event ${eventType}`;

  console.log(
    JSON.stringify({
      level: "info",
      channel: "in-app",
      msg: message,
      eventType,
      payload,
      correlationId,
      jobId: job.id,
      deliveredAt: new Date().toISOString(),
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
