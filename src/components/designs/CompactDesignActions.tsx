"use client";

import { useMemo, useState } from "react";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { RequestSignOffModal } from "@/components/approvals/RequestSignOffModal";
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

function appVariantForAction(
  variant: ResolvedWorkflowAction["variant"],
): "primary" | "outline" | "secondary" {
  if (variant === "primary") return "primary";
  if (variant === "outline") return "outline";
  return "secondary";
}

export function CompactDesignActions({
  design,
  permissions,
  employeeId,
  roleCode,
  onAssignTask,
  className,
}: CompactDesignActionsProps) {
  const [signOffOpen, setSignOffOpen] = useState(false);

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

  function handleAction(action: ResolvedWorkflowAction) {
    if (!action.enabled) return;
    if (action.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL) {
      setSignOffOpen(true);
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
              <AppButtonLink
                key={`${action.code}-${action.taskId ?? action.designId}`}
                href={action.href}
                appVariant={appVariantForAction(action.variant)}
                size="sm"
              >
                {action.label}
              </AppButtonLink>
            );
          }
          return (
            <AppButton
              key={`${action.code}-${action.taskId ?? action.designId}`}
              type="button"
              size="sm"
              appVariant={appVariantForAction(action.variant)}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </AppButton>
          );
        })}
      </div>
      <RequestSignOffModal
        open={signOffOpen}
        designId={design.id}
        ideaRef={design.ideaRef}
        onClose={() => setSignOffOpen(false)}
        onSuccess={() => {
          setSignOffOpen(false);
        }}
      />
    </div>
  );
}
