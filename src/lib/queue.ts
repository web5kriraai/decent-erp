import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const queueDisabled = process.env.NOTIFICATIONS_QUEUE_DISABLED === "true";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 3_000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1_000)),
    });
  }
  return connection;
}

export const NOTIFICATION_QUEUE = "decent-erp-notifications";

let notificationQueue: Queue | null = null;

function getNotificationQueue() {
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

export async function enqueueNotification(job: NotificationJobPayload): Promise<void> {
  if (queueDisabled) return;

  try {
    const queue = getNotificationQueue();
    await queue.add(job.eventType, job, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Notification queue unavailable",
        eventType: job.eventType,
        error: String(error),
      }),
    );
  }
}

export function startNotificationWorker(
  processor: (job: Job<NotificationJobPayload>) => Promise<void>,
) {
  if (queueDisabled) {
    throw new Error("Notification worker cannot start when NOTIFICATIONS_QUEUE_DISABLED=true");
  }
  return new Worker<NotificationJobPayload>(NOTIFICATION_QUEUE, processor, {
    connection: getConnection(),
  });
}
