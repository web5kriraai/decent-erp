"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBreadcrumbReplacement } from "@/components/layout/BreadcrumbProvider";
import { QueryState } from "@/components/ui/QueryState";
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

  const canApprove = permissions.includes(PERMISSIONS.DESIGN_APPROVE);
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
      canApprove,
      canExecute,
    });
  }, [canApprove, canExecute, designQuery.data, employeeId]);

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
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
                      Edit Concept
                    </button>
                  )}
                  <Link href={ROUTES.designs.list} className="btn btn-secondary btn-sm">
                    Back
                  </Link>
                </>
              }
            />

            {showConceptSetup && (
              <div className="alert alert-info stack-section" role="status" id="concept-setup">
                <strong>Step 2 — Attach references</strong>
                <p style={{ margin: "0.25rem 0 0" }}>
                  Upload product and reference images below. Mark one image as primary when ready.
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
              <section className="card">
                <h3 className="card-title stack-section-sm">Design Files</h3>
                <ImageGallery designId={designId} canUpload={canUploadFiles} />
              </section>
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
