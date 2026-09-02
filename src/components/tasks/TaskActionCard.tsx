"use client";

import Link from "next/link";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { AppButton } from "@/components/ui/AppButton";
import { ROUTES } from "@/config/routes";
import type { DesignTask, Priority } from "@/lib/types/api";
import { resolveEffectiveTaskPriority } from "@/lib/task-priority";
import {
  formatActionCenterListHint,
  resolveListItemDisplayStatus,
  shouldApplyWaitingListStyle,
  shouldShowDueInList,
  shouldShowPriorityInList,
  type ActionCenterListVariant,
} from "@/lib/task-action-display";
import { cn } from "@/lib/utils";

function formatCollectionLabel(name: string) {
  if (/workday\s+\d{10,}/i.test(name)) return null;
  return name;
}

function taskPrimaryLabel(task: DesignTask) {
  const collection = formatCollectionLabel(task.design.collectionName);
  if (collection) return collection;
  return task.design.ideaRef;
}

function taskSecondaryLabel(task: DesignTask) {
  const collection = formatCollectionLabel(task.design.collectionName);
  if (collection && collection !== task.design.ideaRef) {
    return task.design.ideaRef;
  }
  return null;
}

function taskDisplayPriority(task: DesignTask): Priority {
  return resolveEffectiveTaskPriority(task.priority, task.design.priority);
}

function formatDueHint(dueAt?: string | null) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Overdue ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type TaskActionCardProps = {
  task: DesignTask;
  selected?: boolean;
  active?: boolean;
  showStartButton?: boolean;
  isPending?: boolean;
  onSelect?: () => void;
  onStart?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

export function TaskActionCard({
  task,
  selected,
  active,
  showStartButton = false,
  isPending,
  onSelect,
  onStart,
  onKeyDown,
}: TaskActionCardProps) {
  const dueHint = formatDueHint(task.dueAt);
  const canStart = task.canStart ?? false;
  const priority = taskDisplayPriority(task);
  const primaryLabel = taskPrimaryLabel(task);
  const secondaryLabel = taskSecondaryLabel(task);
  const startLabel =
    task.status === "CORRECTION_REQUIRED" ? "Restart" : task.status === "PENDING" ? "Start" : "Start";

  return (
    <article
      className={cn(
        "task-card",
        `task-card--priority-${priority}`,
        selected && "task-card--selected",
        active && "task-card--active",
      )}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${primaryLabel} ${task.subProcess.name}`}
      aria-current={active ? "true" : undefined}
    >
      <div className="task-card-header">
        <p className="task-card-ref">
          <Link
            href={ROUTES.work.taskDetail(task.id)}
            className="data-table-link"
            onClick={(e) => e.stopPropagation()}
          >
            {primaryLabel}
          </Link>
        </p>
        <PriorityBadge priority={priority} />
      </div>

      {secondaryLabel ? <p className="task-card-idea-ref">{secondaryLabel}</p> : null}
      <p className="task-card-title">{task.subProcess.name}</p>
      {dueHint ? <p className="task-card-due">{dueHint}</p> : null}

      <div className="task-card-meta">
        <StatusBadge status={resolveListItemDisplayStatus(task)} />
        {showStartButton ? (
          <AppButton
            type="button"
            size="sm"
            className={cn(!canStart && "task-card-start--disabled")}
            disabled={isPending || !canStart}
            title={!canStart ? task.startBlockedReason : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (canStart) onStart?.();
            }}
          >
            {startLabel}
          </AppButton>
        ) : null}
      </div>

      {showStartButton && !canStart && task.startBlockedReason ? (
        <p className="task-card-blocked-hint" role="status">
          {task.startBlockedReason}
        </p>
      ) : null}
    </article>
  );
}

export function TaskActionListItem({
  task,
  variant = "active",
}: {
  task: DesignTask;
  variant?: ActionCenterListVariant;
}) {
  const showPriority = shouldShowPriorityInList(variant);
  const showDue = shouldShowDueInList(variant);
  const dueHint = showDue ? formatDueHint(task.dueAt) : null;
  const listHint = formatActionCenterListHint(task, variant);
  const priority = taskDisplayPriority(task);
  const primaryLabel = taskPrimaryLabel(task);
  const secondaryLabel = taskSecondaryLabel(task);
  const displayStatus = resolveListItemDisplayStatus(task);

  return (
    <li
      className={cn(
        "action-center-list-item",
        variant === "completed" && "action-center-list-item--done",
        shouldApplyWaitingListStyle(task, variant) && "action-center-list-item--waiting",
      )}
    >
      <div>
        <div className="task-list-item-head">
          <Link href={ROUTES.work.taskDetail(task.id)} className="data-table-link">
            {primaryLabel} · {task.subProcess.name}
          </Link>
          {showPriority ? <PriorityBadge priority={priority} /> : null}
        </div>
        {secondaryLabel ? <p className="action-center-list-meta">{secondaryLabel}</p> : null}
        {listHint ? (
          <p className="action-center-list-detail action-center-list-detail--muted">{listHint}</p>
        ) : dueHint ? (
          <p className="action-center-list-detail">{dueHint}</p>
        ) : null}
      </div>
      <StatusBadge status={displayStatus} />
    </li>
  );
}
