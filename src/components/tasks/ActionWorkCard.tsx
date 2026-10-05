"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
 * Whole card opens the task; footer buttons keep their own clicks.
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
  const router = useRouter();

  function openTask() {
    onSelect?.();
    router.push(href);
  }

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, [data-card-no-nav]")) {
      return;
    }
    openTask();
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTask();
    }
  }

  return (
    <article
      className={cn(
        "task-card task-card--openable",
        `task-card--priority-${priority}`,
        selected && "task-card--selected",
        active && "task-card--active",
        waiting && "task-card--waiting",
        className,
      )}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`${designTitle} · ${stageName}. Open task.`}
      aria-current={active ? "true" : undefined}
    >
      <div className="task-card-header">
        <p className="task-card-design">
          <Link
            href={href}
            className="task-card-design-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
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
        {footerAction ? (
          <div className="task-card-meta-action" data-card-no-nav>
            {footerAction}
          </div>
        ) : null}
      </div>
    </article>
  );
}
