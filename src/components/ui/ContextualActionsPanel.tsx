"use client";

import Link from "next/link";
import { ActionUnavailable } from "@/components/ui/ActionUnavailable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedWorkflowAction } from "@/lib/workflow-actions/types";

type ContextualActionsPanelProps = {
  title?: string;
  actions: ResolvedWorkflowAction[];
  className?: string;
  onAction?: (action: ResolvedWorkflowAction) => void;
  showDisabled?: boolean;
};

export function ContextualActionsPanel({
  title = "Actions",
  actions,
  className,
  onAction,
  showDisabled = true,
}: ContextualActionsPanelProps) {
  if (actions.length === 0) return null;

  const enabled = actions.filter((a) => a.enabled);
  const disabled = showDisabled ? actions.filter((a) => !a.enabled && a.disabledReason) : [];

  return (
    <div className={cn("contextual-actions-panel", className)}>
      <p className="contextual-actions-title">{title}</p>
      {enabled.length > 0 ? (
        <div className="contextual-actions-buttons">
          {enabled.map((action) => {
            if (action.href && !onAction) {
              return (
                <Link
                  key={`${action.code}-${action.taskId ?? action.designId ?? action.label}`}
                  href={action.href}
                  className={cn(
                    "btn btn-sm",
                    action.variant === "primary" && "btn-primary",
                    action.variant === "secondary" && "btn-secondary",
                    action.variant === "outline" && "btn-outline",
                    action.variant === "destructive" && "btn-danger",
                    action.variant === "warning" && "btn-warning",
                  )}
                >
                  {action.label}
                </Link>
              );
            }
            return (
              <Button
                key={`${action.code}-${action.taskId ?? action.designId ?? action.label}`}
                type="button"
                size="sm"
                variant={
                  action.variant === "primary"
                    ? "default"
                    : action.variant === "destructive"
                      ? "destructive"
                      : action.variant === "outline"
                        ? "outline"
                        : "secondary"
                }
                onClick={() => onAction?.(action)}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      ) : null}
      {disabled.length > 0 ? (
        <div className="contextual-actions-disabled">
          {disabled.map((action) => (
            <ActionUnavailable
              key={`disabled-${action.code}`}
              compact
              reason={`${action.label} — ${action.disabledReason}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
