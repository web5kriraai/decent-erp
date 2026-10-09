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
  /** Marks this specific outbox row processed after delivery (avoids updateMany by eventType). */
  outboxId?: string;
  /** In-app row was already written when the outbox was created. */
  skipInApp?: boolean;
};

export function isNotificationQueueDisabled(): boolean {
  return queueDisabled;
}

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

/** Spec §17 - repeatable due-soon / overdue scanner (every 15 minutes). */
export const SCAN_TASK_DUES_EVENT = "SCAN_TASK_DUES";

/** Spec §13.2 - move aged AuditLog rows into archive table (daily). */
export const SCAN_AUDIT_ARCHIVE_EVENT = "SCAN_AUDIT_ARCHIVE";

/** Live ERP design-success partner pull (hourly when ERP_API_BASE_URL is set). */
export const SCAN_DESIGN_SUCCESS_ERP_EVENT = "SCAN_DESIGN_SUCCESS_ERP";

export async function ensureTaskDueScanSchedule(): Promise<void> {
  if (queueDisabled) return;
  try {
    const queue = getNotificationQueue();
    await queue.upsertJobScheduler(
      "scan-task-dues",
      { every: 15 * 60_000 },
      {
        name: SCAN_TASK_DUES_EVENT,
        data: {
          eventType: SCAN_TASK_DUES_EVENT,
          payload: {},
          correlationId: "scan-task-dues-repeat",
        },
      },
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Could not register SCAN_TASK_DUES job scheduler",
        error: String(error),
      }),
    );
  }
}

export async function ensureAuditArchiveSchedule(): Promise<void> {
  if (queueDisabled) return;
  try {
    const queue = getNotificationQueue();
    await queue.upsertJobScheduler(
      "scan-audit-archive",
      { every: 24 * 60 * 60_000 },
      {
        name: SCAN_AUDIT_ARCHIVE_EVENT,
        data: {
          eventType: SCAN_AUDIT_ARCHIVE_EVENT,
          payload: {},
          correlationId: "scan-audit-archive-repeat",
        },
      },
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Could not register SCAN_AUDIT_ARCHIVE job scheduler",
        error: String(error),
      }),
    );
  }
}

export async function ensureDesignSuccessErpScanSchedule(): Promise<void> {
  if (queueDisabled) return;
  try {
    const queue = getNotificationQueue();
    await queue.upsertJobScheduler(
      "scan-design-success-erp",
      { every: 60 * 60_000 },
      {
        name: SCAN_DESIGN_SUCCESS_ERP_EVENT,
        data: {
          eventType: SCAN_DESIGN_SUCCESS_ERP_EVENT,
          payload: {},
          correlationId: "scan-design-success-erp-repeat",
        },
      },
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Could not register SCAN_DESIGN_SUCCESS_ERP job scheduler",
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
