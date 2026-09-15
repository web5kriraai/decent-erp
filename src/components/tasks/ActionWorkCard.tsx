"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { Priority } from "@/lib/types/api";
import { cn } from "@/lib/utils";

export type ActionWorkCardProps = {
  href: string;
  designTitle: string;
  ideaRef: string;
  stageName: string;
  priority: Priority;
  status: string;
  /** Due date, blocked reason, or completion hint — always reserves a line. */
  hint?: string | null;
  hintTone?: "default" | "muted" | "warning";
  footerAction?: ReactNode;
  selected?: boolean;
  active?: boolean;
  waiting?: boolean;
  onSelect?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
};

/**
 * Shared Action Center card shell — same hierarchy on kanban, blocked, upcoming, completed.
 * 1) Design title + priority  2) Idea ref  3) Stage  4) Hint  5) Status + action
 */
export function ActionWorkCard({
  href,
  designTitle,
  ideaRef,
  stageName,
  priority,
  status,
  hint,
  hintTone = "default",
  footerAction,
  selected,
  active,
  waiting,
  onSelect,
  onKeyDown,
  className,
}: ActionWorkCardProps) {
  const interactive = !!onSelect;

  return (
    <article
      className={cn(
        "task-card",
        `task-card--priority-${priority}`,
        selected && "task-card--selected",
        active && "task-card--active",
        waiting && "task-card--waiting",
        className,
      )}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`${designTitle} · ${stageName}`}
      aria-current={active ? "true" : undefined}
    >
      <div className="task-card-header">
        <p className="task-card-design">
          <Link
            href={href}
            className="task-card-design-link"
            onClick={(e) => e.stopPropagation()}
          >
            {designTitle}
          </Link>
        </p>
        <PriorityBadge priority={priority} className="task-card-priority shrink-0" />
      </div>

      <p className="task-card-idea-ref" title={ideaRef}>
        {ideaRef}
      </p>

      <p className="task-card-title">{stageName}</p>

      <p
        className={cn(
          "task-card-hint",
          hintTone === "muted" && "task-card-hint--muted",
          hintTone === "warning" && "task-card-hint--warning",
          !hint && "task-card-hint--empty",
        )}
      >
        {hint || "\u00A0"}
      </p>

      <div className="task-card-meta">
        <StatusBadge status={status} />
        {footerAction ? <div className="task-card-meta-action">{footerAction}</div> : null}
      </div>
    </article>
  );
}
