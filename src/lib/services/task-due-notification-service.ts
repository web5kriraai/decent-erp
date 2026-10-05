import { prisma } from "@/lib/db";
import { enqueueOutboxAndNotify } from "@/lib/notifications";

const OPEN_TASK_STATUSES = [
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "CORRECTION_REQUIRED",
] as const;

/** Hours ahead of dueAt that count as "due soon". */
export function taskDueSoonHours(): number {
  const raw = Number(process.env.TASK_DUE_SOON_HOURS ?? 24);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

/** Skip re-notifying the same employee+event+task within this window. */
const DEDUP_HOURS = 12;

async function alreadyNotified(
  eventType: string,
  employeeId: number,
  taskId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_HOURS * 3600_000);
  const existing = await prisma.notificationOutbox.findFirst({
    where: {
      eventType,
      createdAtUtc: { gte: since },
      AND: [
        { payload: { path: ["taskId"], equals: taskId } },
        { payload: { path: ["employeeId"], equals: employeeId } },
      ],
    },
    select: { id: true },
  });
  return !!existing;
}

export type TaskDueScanResult = {
  dueSoonCount: number;
  overdueCount: number;
  notified: number;
  skippedDedup: number;
};

/**
 * Spec §17: notify assignees for due-soon tasks; assignees + Design Head for overdue.
 * Safe to run on a schedule; dedups per employee/event/task for DEDUP_HOURS.
 */
export async function scanAndNotifyTaskDues(
  correlationId = `scan-dues-${Date.now()}`,
): Promise<TaskDueScanResult> {
  const now = new Date();
  const hours = taskDueSoonHours();
  const soonEnd = new Date(now.getTime() + hours * 3600_000);

  const select = {
    id: true,
    assignedEmployeeId: true,
    dueAt: true,
    design: {
      select: {
        designHeadEmployeeId: true,
        ideaRef: true,
      },
    },
  } as const;

  const [dueSoon, overdue] = await Promise.all([
    prisma.designTask.findMany({
      where: {
        dueAt: { gt: now, lte: soonEnd },
        status: { in: [...OPEN_TASK_STATUSES] },
        assignedEmployeeId: { not: null },
      },
      select,
    }),
    prisma.designTask.findMany({
      where: {
        dueAt: { lt: now },
        status: { in: [...OPEN_TASK_STATUSES] },
        assignedEmployeeId: { not: null },
      },
      select,
    }),
  ]);

  let notified = 0;
  let skippedDedup = 0;

  for (const task of dueSoon) {
    const employeeId = task.assignedEmployeeId!;
    const taskId = task.id.toString();
    if (await alreadyNotified("TASK_DUE_SOON", employeeId, taskId)) {
      skippedDedup += 1;
      continue;
    }
    await enqueueOutboxAndNotify(
      "TASK_DUE_SOON",
      {
        taskId,
        employeeId,
        dueAt: task.dueAt?.toISOString(),
        ideaRef: task.design.ideaRef,
      },
      correlationId,
    );
    notified += 1;
  }

  for (const task of overdue) {
    const taskId = task.id.toString();
    const recipients = new Set<number>([task.assignedEmployeeId!]);
    if (task.design.designHeadEmployeeId) {
      recipients.add(task.design.designHeadEmployeeId);
    }

    for (const employeeId of recipients) {
      if (await alreadyNotified("TASK_OVERDUE", employeeId, taskId)) {
        skippedDedup += 1;
        continue;
      }
      await enqueueOutboxAndNotify(
        "TASK_OVERDUE",
        {
          taskId,
          employeeId,
          dueAt: task.dueAt?.toISOString(),
          ideaRef: task.design.ideaRef,
        },
        correlationId,
      );
      notified += 1;
    }
  }

  return {
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    notified,
    skippedDedup,
  };
}
