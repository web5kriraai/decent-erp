/** Display helpers for Action Center cards and list rows. */

import type { Priority } from "@/lib/types/api";
import { resolveEffectiveTaskPriority } from "@/lib/task-priority";

export type ActionCenterListVariant = "active" | "completed" | "upcoming" | "blocked";

export type ActionCenterDisplayTask = {
  status: string;
  effectiveStatus?: string;
  completedAt?: string | Date | null;
  waitingOnStage?: string | null;
  waitingOnAssignee?: string | null;
  isWaitingOnOthers?: boolean;
};

export type ActionDesignLabels = {
  /** Human design title (collection when meaningful, otherwise idea ref). */
  designTitle: string;
  /** Always the idea reference for the ID line. */
  ideaRef: string;
};

/** Stable labels so every action card keeps the same two top lines. */
export function resolveActionDesignLabels(design: {
  collectionName?: string | null;
  ideaRef?: string | null;
}): ActionDesignLabels {
  const ideaRef = design.ideaRef?.trim() || "—";
  const raw = design.collectionName?.trim() || "";
  const isNoise = !raw || /^workday\s+\d{10,}/i.test(raw) || raw === ideaRef;
  return {
    designTitle: isNoise ? ideaRef : raw,
    ideaRef,
  };
}

export function resolveActionPriority(
  taskPriority?: string | null,
  designPriority?: string | null,
): Priority {
  return resolveEffectiveTaskPriority(taskPriority || "MEDIUM", designPriority);
}

export function formatDueHint(dueAt?: string | Date | null): string | null {
  if (!dueAt) return null;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Overdue ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function resolveListItemDisplayStatus(task: ActionCenterDisplayTask): string {
  return task.effectiveStatus ?? task.status;
}

export function formatActionCenterCompletedAt(completedAt?: string | Date | null): string | null {
  if (!completedAt) return null;
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCompleted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfCompleted.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff === 0) return "Completed today";
  if (dayDiff === 1) return "Completed yesterday";
  if (dayDiff <= 7) return `Completed ${dayDiff}d ago`;
  return `Completed ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatActionCenterListHint(
  task: ActionCenterDisplayTask,
  variant: ActionCenterListVariant,
): string | null {
  const displayStatus = resolveListItemDisplayStatus(task);

  if (variant === "completed") {
    if (task.isWaitingOnOthers) {
      return "Your stage is done · design continues in pipeline";
    }
    return formatActionCenterCompletedAt(task.completedAt);
  }

  if (variant === "upcoming") {
    if (displayStatus === "CHECKING") {
      const approver = task.waitingOnAssignee ?? "approver";
      const stage = task.waitingOnStage ?? "approval";
      return `Submitted · waiting on ${approver} (${stage})`;
    }
    if (displayStatus === "COMPLETED" && task.isWaitingOnOthers) {
      return "Your stage is done · design continues in pipeline";
    }
    if (displayStatus === "PENDING") {
      return "Starts when prior stages complete";
    }
  }

  return null;
}

export function shouldApplyWaitingListStyle(
  task: ActionCenterDisplayTask,
  variant: ActionCenterListVariant,
): boolean {
  return variant === "upcoming" && resolveListItemDisplayStatus(task) === "CHECKING";
}

export function shouldShowPriorityInList(variant: ActionCenterListVariant): boolean {
  return variant === "active" || variant === "blocked";
}

export function shouldShowDueInList(variant: ActionCenterListVariant): boolean {
  return variant === "active";
}
