"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestDesignApproval } from "@/hooks/use-approvals";
import { resolveDesignContextActions } from "@/lib/workflow-actions";
import type { DesignSummary } from "@/lib/types/api";
import type { ResolvedWorkflowAction } from "@/lib/workflow-actions/types";
import { WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions/types";
import { cn } from "@/lib/utils";

type CompactDesignActionsProps = {
  design: DesignSummary;
  permissions: string[];
  employeeId?: number;
  roleCode?: string;
  onAssignTask?: (taskId: string) => void;
  className?: string;
};

export function CompactDesignActions({
  design,
  permissions,
  employeeId,
  roleCode,
  onAssignTask,
  className,
}: CompactDesignActionsProps) {
  const requestApproval = useRequestDesignApproval();
  const [disabledHint, setDisabledHint] = useState<string | null>(null);

  const actions = useMemo(
    () =>
      resolveDesignContextActions({
        design,
        employeeId,
        permissions,
        roleCode,
      }),
    [design, employeeId, permissions, roleCode],
  );

  if (actions.length === 0) return null;

  const enabled = actions.filter((a) => a.enabled);
  const disabled = actions.filter((a) => !a.enabled && a.disabledReason);

  function handleAction(action: ResolvedWorkflowAction) {
    if (!action.enabled) {
      setDisabledHint(action.disabledReason ?? `${action.label} is not available right now.`);
      return;
    }
    if (action.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL) {
      requestApproval.mutate(design.id);
      return;
    }
    if (action.code === WORKFLOW_ACTION_CODES.ASSIGN_TASK && action.taskId && onAssignTask) {
      onAssignTask(action.taskId);
    }
  }

  return (
    <div className={cn("compact-design-actions", className)}>
      <div className="compact-design-actions-row">
        {enabled.map((action) => {
          if (action.href && action.code !== WORKFLOW_ACTION_CODES.REQUEST_APPROVAL) {
            return (
              <Link
                key={`${action.code}-${action.taskId ?? action.designId}`}
                href={action.href}
                className={cn(
                  "btn btn-sm",
                  action.variant === "primary" && "btn-primary",
                  action.variant === "outline" && "btn-outline",
                  action.variant === "secondary" && "btn-secondary",
                )}
              >
                {action.label}
              </Link>
            );
          }
          return (
            <Button
              key={`${action.code}-${action.taskId ?? action.designId}`}
              type="button"
              size="sm"
              variant={
                action.variant === "primary"
                  ? "default"
                  : action.variant === "outline"
                    ? "outline"
                    : "secondary"
              }
              disabled={
                action.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL && requestApproval.isPending
              }
              onClick={() => handleAction(action)}
            >
              {action.label}
            </Button>
          );
        })}
        {disabled.map((action) => (
          <Button
            key={`disabled-${action.code}`}
            type="button"
            size="sm"
            variant="outline"
            disabled
            title={action.disabledReason}
            onClick={() => setDisabledHint(action.disabledReason ?? null)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {disabledHint ? (
        <p className="compact-design-actions-hint" role="status">
          {disabledHint}
        </p>
      ) : null}
    </div>
  );
}
