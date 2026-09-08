"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { useDesignCosts } from "@/hooks/use-costing";
import { AssignTaskModal } from "@/features/designs/AssignTaskModal";
import { DesignCompletionSummaryPanel, canViewDesignCompletionSummary } from "@/features/designs/DesignCompletionSummaryPanel";
import { DesignEditModal } from "@/features/designs/DesignEditModal";
import { WorkflowOverrideActions } from "@/features/designs/WorkflowOverrideActions";
import { DesignDetailTabsBody } from "@/features/designs/DesignDetailModal";
import type { DesignDetailTab } from "@/features/designs/DesignDetailModalProvider";
import { DesignWorkflowPanel } from "@/components/designs/DesignWorkflowPanel";
import { DesignActiveTaskTimer } from "@/components/designs/DesignActiveTaskTimer";
import { CompactDesignActions } from "@/components/designs/CompactDesignActions";
import { InlineStageApprovalCard } from "@/components/designs/InlineStageApprovalCard";
import { ManagementApprovalCard } from "@/components/designs/ManagementApprovalCard";
import { getPendingStageApproval } from "@/lib/design-workflow";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";

export function DesignDetailView({
  designId,
  showConceptSetup = false,
  highlightImageId = null,
}: {
  designId: string;
  /** When true (e.g. ?setup=images), emphasize the primary-image gate after create. */
  showConceptSetup?: boolean;
  highlightImageId?: string | null;
}) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const employeeId = session?.user?.employeeId;
  const designQuery = useDesign(designId);
  const [assignTask, setAssignTask] = useState<DesignTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DesignDetailTab>(
    highlightImageId || showConceptSetup ? "files" : "overview",
  );

  useBreadcrumbReplacement(designId, designQuery.data?.ideaRef);

  const roleCode = session?.user?.roleCode;
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const canEdit = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const canOverrideWorkflow = permissions.includes(PERMISSIONS.WORKFLOW_OVERRIDE);
  const canViewCompletion = canViewDesignCompletionSummary(permissions);
  const images = designQuery.data?.images ?? [];
  const needsPrimaryImage = images.length === 0 || !images.some((img) => img.isPrimary);
  const showImageGate = needsPrimaryImage || (showConceptSetup && images.length === 0);

  const pendingStageApproval = useMemo(() => {
    if (!designQuery.data) return null;
    return getPendingStageApproval({
      design: designQuery.data,
      employeeId,
      roleCode,
      canExecute,
    });
  }, [canExecute, designQuery.data, employeeId, roleCode]);

  const isFinalApproval =
    pendingStageApproval?.approvalTask.subProcess?.code === "FINAL_APPROVAL";
  const costsQuery = useDesignCosts(designId, isFinalApproval);
  const sampleOutcomeForFinal = useMemo(() => {
    if (!isFinalApproval || !designQuery.data?.tasks) return null;
    const sampleCheck = designQuery.data.tasks.find(
      (t) => t.subProcess?.code === "SAMPLE_CHECK",
    );
    if (!sampleCheck) return null;
    if (sampleCheck.status === "COMPLETED") return "APPROVE";
    if (sampleCheck.status === "CORRECTION_REQUIRED") return "REJECT / RESAMPLE pending";
    return sampleCheck.status;
  }, [designQuery.data?.tasks, isFinalApproval]);

  return (
    <div className="page-shell">
      <QueryState
        isLoading={designQuery.isLoading}
        isError={designQuery.isError}
        error={designQuery.error}
        onRetry={() => designQuery.refetch()}
        notFoundHref={ROUTES.designs.list}
        notFoundLabel="Back to designs"
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
                  {canEdit ? (
                    <AppButton
                      type="button"
                      appVariant="outline"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit Concept
                    </AppButton>
                  ) : null}
                  <AppButtonLink href={ROUTES.designs.list} appVariant="ghost" size="sm">
                    Back
                  </AppButtonLink>
                </>
              }
              />

            {showImageGate ? (
              <div className="alert alert-warning" role="status">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium">
                    {images.length === 0
                      ? "Add at least one design image and mark it as primary before starting workflow tasks."
                      : "Mark one uploaded image as primary before starting workflow tasks."}
                  </p>
                  <p className="mt-1 mb-0 text-sm opacity-90">
                    Workflow timers stay blocked until a primary image is set.{" "}
                    <Link
                      href={`${ROUTES.designs.detail(designId)}?setup=images#design-files`}
                      className="font-medium underline underline-offset-2"
                    >
                      Open image upload
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}

            {canExecute ? (
              <DesignActiveTaskTimer
                designId={designId}
                employeeId={employeeId}
                tasks={designQuery.data.tasks}
                roleCode={roleCode}
                permissions={permissions}
              />
            ) : null}

            {pendingStageApproval ? (
              <InlineStageApprovalCard
                designId={designId}
                design={designQuery.data}
                approvalTask={pendingStageApproval.approvalTask}
                workTask={pendingStageApproval.workTask}
                employeeId={employeeId}
                canAssign={canAssign}
                costingTotal={
                  isFinalApproval ? costsQuery.data?.summary.totalDevCost : undefined
                }
                costingEntryCount={
                  isFinalApproval ? costsQuery.data?.summary.entryCount : undefined
                }
                sampleOutcome={isFinalApproval ? sampleOutcomeForFinal : undefined}
              />
            ) : (
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
            )}

            <DesignWorkflowPanel
              design={designQuery.data}
              designId={designId}
              canAssign={canAssign}
              onAssignTask={setAssignTask}
              headerActions={
                canOverrideWorkflow ? (
                  <WorkflowOverrideActions
                    designId={designId}
                    design={designQuery.data}
                  />
                ) : null
              }
            />

            {designQuery.data.status === "APPROVAL_PENDING" ? (
              <ManagementApprovalCard
                designId={designId}
                ideaRef={designQuery.data.ideaRef}
              />
            ) : null}

            <DesignCompletionSummaryPanel
              designId={designId}
              design={designQuery.data}
              enabled={canViewCompletion}
            />

            <AppCard title="Design detail" id="design-files">
              <DesignDetailTabsBody
                designId={designId}
                tab={detailTab}
                onTabChange={setDetailTab}
                compactHero
                highlightImageId={highlightImageId}
              />
            </AppCard>

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
