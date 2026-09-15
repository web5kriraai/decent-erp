"use client";

import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ActionWorkCard } from "@/components/tasks/ActionWorkCard";
import { ROUTES } from "@/config/routes";
import type { DesignTask } from "@/lib/types/api";
import {
  formatActionCenterListHint,
  formatDueHint,
  resolveActionDesignLabels,
  resolveActionPriority,
  resolveListItemDisplayStatus,
  shouldApplyWaitingListStyle,
  type ActionCenterListVariant,
} from "@/lib/task-action-display";
import { cn } from "@/lib/utils";

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
  const labels = resolveActionDesignLabels(task.design);
  const priority = resolveActionPriority(task.priority, task.design.priority);
  const dueHint = formatDueHint(task.dueAt);
  const canStart = task.canStart ?? false;
  const blockedHint = showStartButton && !canStart ? task.startBlockedReason : null;
  const hint = blockedHint || dueHint;
  const hintTone = blockedHint ? "warning" : "default";
  const startLabel = task.status === "CORRECTION_REQUIRED" ? "Restart" : "Start";

  return (
    <ActionWorkCard
      href={ROUTES.work.taskDetail(task.id)}
      designTitle={labels.designTitle}
      ideaRef={labels.ideaRef}
      stageName={task.subProcess.name}
      priority={priority}
      status={resolveListItemDisplayStatus(task)}
      hint={hint}
      hintTone={hintTone}
      selected={selected}
      active={active}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      footerAction={
        showStartButton ? (
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
        ) : null
      }
    />
  );
}

export function TaskActionListItem({
  task,
  variant = "active",
}: {
  task: DesignTask;
  variant?: ActionCenterListVariant;
}) {
  const labels = resolveActionDesignLabels(task.design);
  const priority = resolveActionPriority(task.priority, task.design.priority);
  const dueHint = variant === "active" ? formatDueHint(task.dueAt) : null;
  const listHint = formatActionCenterListHint(task, variant);
  const hint = listHint || dueHint;
  const waiting = shouldApplyWaitingListStyle(task, variant);

  return (
    <li className="action-center-list-item action-center-list-item--card">
      <ActionWorkCard
        href={ROUTES.work.taskDetail(task.id)}
        designTitle={labels.designTitle}
        ideaRef={labels.ideaRef}
        stageName={task.subProcess.name}
        priority={priority}
        status={resolveListItemDisplayStatus(task)}
        hint={hint}
        hintTone={listHint && variant !== "active" ? "muted" : "default"}
        waiting={waiting}
      />
    </li>
  );
}

export function BlockedActionCard({
  item,
}: {
  item: {
    taskId: string;
    design: { id: string; ideaRef: string; collectionName: string };
    stage: string;
    status: string;
    priority?: string | null;
    designPriority?: string | null;
    blockedMessage: string;
  };
}) {
  const labels = resolveActionDesignLabels(item.design);
  const priority = resolveActionPriority(item.priority, item.designPriority);

  return (
    <li className="action-center-list-item action-center-list-item--card">
      <ActionWorkCard
        href={ROUTES.work.taskDetail(item.taskId)}
        designTitle={labels.designTitle}
        ideaRef={labels.ideaRef}
        stageName={item.stage}
        priority={priority}
        status={item.status}
        hint={item.blockedMessage}
        hintTone="warning"
        footerAction={
          <AppButtonLink
            href={ROUTES.work.taskDetail(item.taskId)}
            size="sm"
            appVariant="outline"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </AppButtonLink>
        }
      />
    </li>
  );
}
