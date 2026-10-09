import IORedis from "ioredis";
import { isNotificationQueueDisabled } from "@/lib/queue";

export const REALTIME_TOPICS = [
  "designs",
  "tasks",
  "approvals",
  "notifications",
  "time",
  "kpi",
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export type RealtimeMessage = {
  companyId: number;
  employeeIds?: number[];
  topics: RealtimeTopic[];
  originId: string;
};

const CHANNEL_PREFIX = "decent-erp:realtime:";
const originId = crypto.randomUUID();

type Listener = (message: RealtimeMessage) => void;
const listeners = new Set<Listener>();

let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let redisDisabled = isNotificationQueueDisabled();
let subscriberStarted = false;

function fanoutLocal(message: RealtimeMessage) {
  for (const listener of listeners) {
    try {
      listener(message);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "Realtime listener failed",
          error: String(error),
        }),
      );
    }
  }
}

function disableRedis(error: unknown) {
  if (redisDisabled) return;
  redisDisabled = true;
  console.warn(
    JSON.stringify({
      level: "warn",
      msg: "Realtime Redis unavailable; using in-process events",
      error: String(error),
    }),
  );
  try {
    publisher?.disconnect();
  } catch {
    // already closed
  }
  try {
    subscriber?.disconnect();
  } catch {
    // already closed
  }
  publisher = null;
  subscriber = null;
}

function redisOptions(): ConstructorParameters<typeof IORedis>[1] {
  return {
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    lazyConnect: true,
    retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1_000)),
  };
}

function ensureSubscriber() {
  if (redisDisabled || subscriberStarted) return;
  subscriberStarted = true;
  subscriber = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", redisOptions());
  subscriber.on("error", (error) => disableRedis(error));
  subscriber.on("end", () => {
    if (!redisDisabled) disableRedis("subscriber ended");
  });
  void subscriber
    .connect()
    .then(() => subscriber?.psubscribe(`${CHANNEL_PREFIX}*`))
    .catch((error) => disableRedis(error));
  subscriber.on("pmessage", (_pattern, _channel, raw) => {
    try {
      const message = JSON.parse(raw) as RealtimeMessage;
      if (message.originId === originId) return;
      fanoutLocal(message);
    } catch {
      // Ignore malformed pub/sub payloads.
    }
  });
}

function getPublisher() {
  if (redisDisabled) return null;
  if (!publisher) {
    publisher = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", redisOptions());
    publisher.on("error", (error) => disableRedis(error));
  }
  return publisher;
}

/** Listen for company events. Returns an unsubscribe function. */
export function subscribeRealtime(listener: Listener) {
  ensureSubscriber();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function publishRealtime(input: {
  companyId: number;
  employeeIds?: number[];
  topics: RealtimeTopic[];
}) {
  const topics = [...new Set(input.topics)];
  if (!input.companyId || topics.length === 0) return;

  const message: RealtimeMessage = {
    companyId: input.companyId,
    employeeIds: input.employeeIds,
    topics,
    originId,
  };
  fanoutLocal(message);
  if (redisDisabled) return;

  try {
    const client = getPublisher();
    if (!client) return;
    if (client.status === "wait") await client.connect();
    await client.publish(`${CHANNEL_PREFIX}${input.companyId}`, JSON.stringify(message));
  } catch (error) {
    disableRedis(error);
  }
}

/** Map an outbox event type onto the query topics the open dashboard should refresh. */
export function topicsForEventType(eventType: string): RealtimeTopic[] {
  const topics = new Set<RealtimeTopic>();
  const type = eventType.toUpperCase();

  if (
    type.startsWith("DESIGN_") ||
    type.startsWith("PRODUCTION_") ||
    type.startsWith("ERP_")
  ) {
    topics.add("designs");
  }
  if (
    type.startsWith("TASK_") ||
    type.startsWith("CORRECTION_") ||
    type.includes("HANDOFF")
  ) {
    topics.add("tasks");
    topics.add("designs");
  }
  if (type.startsWith("APPROVAL_") || type === "DESIGN_APPROVED") {
    topics.add("approvals");
    topics.add("designs");
  }
  if (
    type.includes("HOLD") ||
    type.includes("TIME") ||
    type === "TASK_DUE_SOON" ||
    type === "TASK_OVERDUE" ||
    type === "TASK_COMPLETED"
  ) {
    topics.add("time");
  }
  if (type.includes("KPI")) topics.add("kpi");

  if (topics.size === 0) {
    topics.add("designs");
    topics.add("tasks");
  }
  return [...topics];
}
