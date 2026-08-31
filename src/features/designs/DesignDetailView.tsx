"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesign } from "@/hooks/use-designs";
import { useRequestDesignApproval } from "@/hooks/use-approvals";
import { ImageGallery } from "@/components/ImageGallery";
import { AssignTaskModal } from "@/features/designs/AssignTaskModal";
import { DesignEditModal } from "@/features/designs/DesignEditModal";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";

export function DesignDetailView({ designId }: { designId: string }) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const designQuery = useDesign(designId);
  const requestApproval = useRequestDesignApproval();
  const [assignTask, setAssignTask] = useState<DesignTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const canRequestApproval =
    permissions.includes(PERMISSIONS.DESIGN_APPROVE) &&
    designQuery.data &&
    ["DRAFT", "ACTIVE"].includes(designQuery.data.status);
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const canEdit = permissions.includes(PERMISSIONS.DESIGN_CREATE);

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
                  {canRequestApproval && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={requestApproval.isPending}
                      onClick={() => requestApproval.mutate(designId)}
                    >
                      Request Approval
                    </button>
                  )}
                  <Link href={ROUTES.designs.list} className="btn btn-secondary btn-sm">
                    Back
                  </Link>
                </>
              }
            />

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
