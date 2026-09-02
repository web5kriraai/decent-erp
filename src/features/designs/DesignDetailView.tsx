"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBreadcrumbReplacement } from "@/components/layout/BreadcrumbProvider";
import { QueryState } from "@/components/ui/QueryState";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesign } from "@/hooks/use-designs";
import { ImageGallery } from "@/components/ImageGallery";
import { AssignTaskModal } from "@/features/designs/AssignTaskModal";
import { DesignCompletionSummaryPanel } from "@/features/designs/DesignCompletionSummaryPanel";
import { DesignEditModal } from "@/features/designs/DesignEditModal";
import { WorkflowOverrideActions } from "@/features/designs/WorkflowOverrideActions";
import { DesignWorkflowPanel } from "@/components/designs/DesignWorkflowPanel";
import { CompactDesignActions } from "@/components/designs/CompactDesignActions";
import { InlineStageApprovalCard } from "@/components/designs/InlineStageApprovalCard";
import { getPendingStageApproval } from "@/lib/design-workflow";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";

export function DesignDetailView({
  designId,
  showConceptSetup = false,
}: {
  designId: string;
  showConceptSetup?: boolean;
}) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const employeeId = session?.user?.employeeId;
  const designQuery = useDesign(designId);
  const [assignTask, setAssignTask] = useState<DesignTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useBreadcrumbReplacement(designId, designQuery.data?.ideaRef);

  const roleCode = session?.user?.roleCode;
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const canEdit = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const canUploadFiles = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const canOverrideWorkflow = permissions.includes(PERMISSIONS.WORKFLOW_OVERRIDE);

  const pendingStageApproval = useMemo(() => {
    if (!designQuery.data) return null;
    return getPendingStageApproval({
      design: designQuery.data,
      employeeId,
      roleCode,
      canExecute,
    });
  }, [canExecute, designQuery.data, employeeId, roleCode]);

  const showDesignFiles = !pendingStageApproval;

  return (
    <div className="page-shell">
      <QueryState
        isLoading={designQuery.isLoading}
        isError={designQuery.isError}
        error={designQuery.error}
        onRetry={() => designQuery.refetch()}
        skeletonVariant="stats"
      >
        {designQuery.data && (
          <>
            <PageHeader
              title={designQuery.data.ideaRef}
              subtitle={designQuery.data.collectionName}
              actions={
                <>
                  <StatusBadge status={designQuery.data.status} />
                  <PriorityBadge priority={designQuery.data.priority} />
                  {canEdit && (
                    <AppButton
                      type="button"
                      appVariant="secondary"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit Concept
                    </AppButton>
                  )}
                  <AppButtonLink href={ROUTES.designs.list} appVariant="secondary" size="sm">
                    Back
                  </AppButtonLink>
                </>
              }
            />

            {showConceptSetup && (
              <div className="alert alert-info stack-section" role="status" id="concept-setup">
                <strong>Next — add reference images</strong>
                <p className="mt-1 mb-0 text-sm">
                  Upload product and inspiration photos below. Mark one as primary when you&apos;re
                  happy with the set.
                </p>
              </div>
            )}

            {pendingStageApproval ? (
              <InlineStageApprovalCard
                designId={designId}
                design={designQuery.data}
                approvalTask={pendingStageApproval.approvalTask}
                workTask={pendingStageApproval.workTask}
                employeeId={employeeId}
                canAssign={canAssign}
              />
            ) : (
              <div className="mb-4">
                <CompactDesignActions
                  design={designQuery.data}
                  permissions={permissions}
                  employeeId={employeeId}
                  roleCode={roleCode}
                  onAssignTask={(taskId) => {
                    const task = designQuery.data.tasks?.find((t) => t.id === taskId);
                    if (task) setAssignTask(task);
                  }}
                />
              </div>
            )}

            <div className="mb-6">
              <DesignWorkflowPanel
                design={designQuery.data}
                designId={designId}
                canAssign={canAssign}
                onAssignTask={setAssignTask}
              />
            </div>

            {canOverrideWorkflow ? (
              <div className="mb-6">
                <WorkflowOverrideActions designId={designId} design={designQuery.data} />
              </div>
            ) : null}

            <DesignCompletionSummaryPanel
              designId={designId}
              design={designQuery.data}
            />

            {showDesignFiles ? (
              <AppCard title="Design Files">
                <ImageGallery designId={designId} canUpload={canUploadFiles} />
              </AppCard>
            ) : null}

            <AssignTaskModal
              open={!!assignTask}
              task={assignTask}
              onClose={() => setAssignTask(null)}
            />
            <DesignEditModal
              design={designQuery.data}
              open={editOpen}
              onClose={() => setEditOpen(false)}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}
