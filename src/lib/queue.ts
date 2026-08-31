import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let connection: IORedis | null = null;

function getConnection() {
  if (!connection) {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const NOTIFICATION_QUEUE = "decent-erp-notifications";

let notificationQueue: Queue | null = null;

export function getNotificationQueue() {
  if (!notificationQueue) {
    notificationQueue = new Queue(NOTIFICATION_QUEUE, {
      connection: getConnection(),
    });
  }
  return notificationQueue;
}

export type NotificationJobPayload = {
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
};

export async function enqueueNotification(job: NotificationJobPayload) {
  const queue = getNotificationQueue();
  await queue.add(job.eventType, job, {
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export function startNotificationWorker(
  processor: (job: Job<NotificationJobPayload>) => Promise<void>,
) {
  return new Worker<NotificationJobPayload>(NOTIFICATION_QUEUE, processor, {
    connection: getConnection(),
  });
}
