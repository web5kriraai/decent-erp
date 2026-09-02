/** Display helpers for Action Center list rows (completed / upcoming). */

export type ActionCenterListVariant = "active" | "completed" | "upcoming";

export type ActionCenterDisplayTask = {
  status: string;
  effectiveStatus?: string;
  completedAt?: string | Date | null;
  waitingOnStage?: string | null;
  waitingOnAssignee?: string | null;
  isWaitingOnOthers?: boolean;
};

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
  return variant === "active";
}

export function shouldShowDueInList(variant: ActionCenterListVariant): boolean {
  return variant === "active";
}
