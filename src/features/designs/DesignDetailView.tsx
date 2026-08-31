"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesign } from "@/hooks/use-designs";

export function DesignDetailView({ designId }: { designId: string }) {
  const designQuery = useDesign(designId);

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
                  <DetailItem label="Product Type" value={designQuery.data.productType?.name ?? "—"} />
                  <DetailItem label="Season" value={designQuery.data.season?.name ?? "—"} />
                  <DetailItem label="Design Head" value={designQuery.data.designHead?.name ?? "—"} />
                  <DetailItem label="Stage" value={designQuery.data.currentStage ?? "—"} />
                  <DetailItem label="Concept Note" value={designQuery.data.conceptNote ?? "—"} />
                </dl>
              </div>

              <div className="card">
                <div className="card-header" style={{ marginBottom: 0, paddingBottom: "0.75rem" }}>
                  <span className="card-title">Tasks ({designQuery.data.tasks?.length ?? 0})</span>
                </div>
                {designQuery.data.tasks && designQuery.data.tasks.length > 0 ? (
                  <ul className="detail-task-list">
                    {designQuery.data.tasks.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={ROUTES.designs.task(designId, task.id)}
                          className="data-table-link"
                        >
                          {task.subProcess?.name ?? "Task"}
                        </Link>
                        <StatusBadge status={task.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>No tasks generated</p>
                )}
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
