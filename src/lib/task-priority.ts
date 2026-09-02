import type { Priority } from "@/lib/types/api";

export const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export type TaskPrioritySortable = {
  priority: Priority | string;
  dueAt?: Date | string | null;
  design?: { ideaRef?: string };
};

export function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority as Priority] ?? PRIORITY_RANK.MEDIUM;
}

export function compareTasksByPriority(a: TaskPrioritySortable, b: TaskPrioritySortable): number {
  const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (rankDiff !== 0) return rankDiff;

  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;

  return (a.design?.ideaRef ?? "").localeCompare(b.design?.ideaRef ?? "");
}

export function sortTasksByPriority<T extends TaskPrioritySortable>(tasks: T[]): T[] {
  return [...tasks].sort(compareTasksByPriority);
}

/** More urgent of task vs design priority (design URGENT wins over pattern HIGH on tasks). */
export function resolveEffectiveTaskPriority(
  taskPriority: string,
  designPriority?: string | null,
): Priority {
  if (!designPriority) return taskPriority as Priority;
  return priorityRank(taskPriority) <= priorityRank(designPriority)
    ? (taskPriority as Priority)
    : (designPriority as Priority);
}

export function withEffectiveTaskPriority<
  T extends TaskPrioritySortable & { design?: { priority?: string | null } },
>(task: T): T & { priority: Priority } {
  return {
    ...task,
    priority: resolveEffectiveTaskPriority(task.priority, task.design?.priority),
  };
}

export function sortTasksByEffectivePriority<
  T extends TaskPrioritySortable & { design?: { priority?: string | null } },
>(tasks: T[]): Array<T & { priority: Priority }> {
  return sortTasksByPriority(tasks.map(withEffectiveTaskPriority));
}

export type KanbanBucketKey = "READY" | "CORRECTION_REQUIRED" | "RUNNING" | "ON_HOLD";

export type KanbanGroupedTasks<T extends TaskPrioritySortable & { status: string }> = Record<
  KanbanBucketKey,
  T[]
>;

/** Map action-required tasks to kanban lanes; ready PENDING shares Ready to Start. */
export function groupActionCenterTasks<T extends TaskPrioritySortable & { status: string }>(
  tasks: T[],
): KanbanGroupedTasks<T> {
  const groups: KanbanGroupedTasks<T> = {
    READY: [],
    CORRECTION_REQUIRED: [],
    RUNNING: [],
    ON_HOLD: [],
  };

  for (const task of tasks) {
    if (task.status === "ASSIGNED" || task.status === "PENDING") {
      groups.READY.push(task);
    } else if (task.status === "CORRECTION_REQUIRED") {
      groups.CORRECTION_REQUIRED.push(task);
    } else if (task.status === "RUNNING") {
      groups.RUNNING.push(task);
    } else if (task.status === "ON_HOLD") {
      groups.ON_HOLD.push(task);
    }
  }

  return {
    READY: sortTasksByEffectivePriority(groups.READY),
    CORRECTION_REQUIRED: sortTasksByEffectivePriority(groups.CORRECTION_REQUIRED),
    RUNNING: sortTasksByEffectivePriority(groups.RUNNING),
    ON_HOLD: sortTasksByEffectivePriority(groups.ON_HOLD),
  };
}
