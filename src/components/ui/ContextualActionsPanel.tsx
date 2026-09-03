"use client";

import { ActionUnavailable } from "@/components/ui/ActionUnavailable";
import { AppButton, AppButtonLink, type AppButtonVariant } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";
import type { ResolvedWorkflowAction } from "@/lib/workflow-actions/types";

type ContextualActionsPanelProps = {
  title?: string;
  actions: ResolvedWorkflowAction[];
  className?: string;
  onAction?: (action: ResolvedWorkflowAction) => void;
  /** When true, show state-blocked actions with reasons. Permission-denied actions must be omitted by the resolver. */
  showDisabled?: boolean;
};

function toAppVariant(variant: ResolvedWorkflowAction["variant"]): AppButtonVariant {
  if (variant === "destructive") return "danger";
  if (variant === "warning") return "warning";
  if (variant === "outline") return "outline";
  if (variant === "primary") return "primary";
  return "secondary";
}

export function ContextualActionsPanel({
  title,
  actions,
  className,
  onAction,
  showDisabled = true,
}: ContextualActionsPanelProps) {
  if (actions.length === 0) return null;

  const enabled = actions.filter((a) => a.enabled);
  const disabled = showDisabled
    ? actions.filter((a) => !a.enabled && a.disabledReason)
    : [];

  if (enabled.length === 0 && disabled.length === 0) return null;

  let primaryUsed = false;
  const ranked = enabled.map((action) => {
    const variant = action.variant;
    if (variant === "primary") {
      if (primaryUsed) return { ...action, variant: "outline" as const };
      primaryUsed = true;
    }
    return action;
  });

  return (
    <div className={cn("contextual-actions-panel", className)}>
      {title ? <p className="contextual-actions-title">{title}</p> : null}
      {ranked.length > 0 ? (
        <div className="contextual-actions-buttons">
          {ranked.map((action) => {
            if (action.href && !onAction) {
              return (
                <AppButtonLink
                  key={`${action.code}-${action.taskId ?? action.designId ?? action.label}`}
                  href={action.href}
                  appVariant={toAppVariant(action.variant)}
                  size="sm"
                >
                  {action.label}
                </AppButtonLink>
              );
            }
            return (
              <AppButton
                key={`${action.code}-${action.taskId ?? action.designId ?? action.label}`}
                type="button"
                size="sm"
                appVariant={toAppVariant(action.variant)}
                onClick={() => onAction?.(action)}
              >
                {action.label}
              </AppButton>
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
