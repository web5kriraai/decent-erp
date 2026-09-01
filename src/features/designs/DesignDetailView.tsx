"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesign } from "@/hooks/use-designs";
import { ImageGallery } from "@/components/ImageGallery";
import { AssignTaskModal } from "@/features/designs/AssignTaskModal";
import { DesignEditModal } from "@/features/designs/DesignEditModal";
import { DesignWorkflowPanel } from "@/components/designs/DesignWorkflowPanel";
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

  const canApprove = permissions.includes(PERMISSIONS.DESIGN_APPROVE);
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const canEdit = permissions.includes(PERMISSIONS.DESIGN_CREATE);

  const pendingStageApproval = useMemo(() => {
    if (!designQuery.data) return null;
    return getPendingStageApproval({
      design: designQuery.data,
      employeeId,
      canApprove,
      canExecute,
    });
  }, [canApprove, canExecute, designQuery.data, employeeId]);

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
              <div
                className="alert alert-info"
                style={{ marginBottom: "1rem" }}
                role="status"
                id="concept-setup"
              >
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
            ) : null}

            <div className="mb-6">
              <DesignWorkflowPanel
                design={designQuery.data}
                designId={designId}
                employeeId={employeeId}
                canApprove={canApprove}
                canExecute={canExecute}
                canAssign={canAssign}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              <div className="card">
                <h3 style={{ marginBottom: "1rem" }}>Concept</h3>
                <dl className="detail-list">
                  <DetailItem label="Design Number" value={designQuery.data.designNumber ?? "-"} />
                  <DetailItem label="Product Type" value={designQuery.data.productType?.name ?? "-"} />
                  <DetailItem label="Season" value={designQuery.data.season?.name ?? "-"} />
                  <DetailItem label="Design Head" value={designQuery.data.designHead?.name ?? "-"} />
                  <DetailItem label="Stage" value={designQuery.data.currentStage ?? "-"} />
                  <DetailItem label="Concept Note" value={designQuery.data.conceptNote ?? "-"} />
                </dl>
              </div>

              <div className="card">
                <div className="card-header" style={{ marginBottom: 0, paddingBottom: "0.75rem" }}>
                  <span className="card-title">Tasks ({designQuery.data.tasks?.length ?? 0})</span>
                </div>
                {designQuery.data.tasks && designQuery.data.tasks.length > 0 ? (
                  <ul className="detail-task-list">
                    {designQuery.data.tasks.map((task) => (
                      <li key={task.id} className="detail-task-row">
                        <Link
                          href={ROUTES.designs.task(designId, task.id)}
                          className="data-table-link"
                        >
                          {task.subProcess?.name ?? "Task"}
                        </Link>
                        <StatusBadge status={task.status} />
                        {canAssign && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setAssignTask(task as DesignTask)}
                          >
                            Assign
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>No tasks generated</p>
                )}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: "1rem" }}>Design Files</h3>
                <ImageGallery
                  designId={designId}
                  canUpload={permissions.includes(PERMISSIONS.DESIGN_CREATE)}
                />
              </div>

              <div className="card">
                <h3 style={{ marginBottom: "1rem" }}>Approvals & Corrections</h3>
                <p style={{ color: "var(--color-neutral-500)", margin: "0 0 0.5rem" }}>
                  {designQuery.data.approvals?.length ?? 0} approval records
                </p>
                <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>
                  {designQuery.data.corrections?.length ?? 0} correction records
                </p>
              </div>
            </div>
            <AssignTaskModal
              open={!!assignTask}
              task={assignTask}
              onClose={() => setAssignTask(null)}
            />
            {designQuery.data && (
              <DesignEditModal
                design={designQuery.data}
                open={editOpen}
                onClose={() => setEditOpen(false)}
              />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
