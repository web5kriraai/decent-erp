"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useApprovedDesigns,
  useMarkDesignLive,
  useProductionHandoffs,
  useReleasedDesigns,
  useRetryHandoffSync,
} from "@/hooks/use-production";
import { getMarkLiveAvailability } from "@/lib/action-availability";
import { resolveProductionContextActions } from "@/lib/workflow-actions";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";

export function ProductionReleaseView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);

  const designsQuery = useApprovedDesigns(canRelease);
  const releasedQuery = useReleasedDesigns(canRelease);
  const markLive = useMarkDesignLive();
  const handoffsQuery = useProductionHandoffs(canRelease);
  const retrySync = useRetryHandoffSync();

  const productionActions = resolveProductionContextActions({
    permissions,
    designStatus: releasedQuery.data?.[0]?.status,
  });

  if (!canRelease) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.PRODUCTION_RELEASE} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Production Desk"
        subtitle="Complete production instruction and release via My Tasks. ERP module sync runs after release."
      />

      <div className="card contextual-actions-wrap" style={{ marginBottom: "1.5rem" }}>
        <ContextualActionsPanel title="Production desk actions" actions={productionActions} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <span className="card-title">How release works</span>
        </div>
        <div className="card-body" style={{ padding: "1rem 1.25rem" }}>
          <ol style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.6 }}>
            <li>Design Head completes <strong>Production Handoff</strong> after management approval.</li>
            <li>Production Head completes <strong>Production Instruction</strong> on My Tasks.</li>
            <li>Production Head completes <strong>Production Release</strong> on My Tasks — this triggers ERP handoff.</li>
          </ol>
          <p style={{ margin: "0.75rem 0 0" }}>
            <Link href={ROUTES.work.tasks} className="data-table-link">Open My Tasks</Link>
          </p>
        </div>
      </div>

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <span className="card-title">Approved — production workflow</span>
          </div>
          <DataTable
            columns={[
              {
                key: "ideaRef",
                header: "Design",
                render: (row) => (
                  <Link href={ROUTES.designs.detail(row.id)} className="data-table-link">
                    {row.ideaRef}
                  </Link>
                ),
              },
              { key: "collectionName", header: "Collection" },
              { key: "productType", header: "Product", render: (r) => r.productType.name },
              { key: "designHead", header: "Design Head", render: (r) => r.designHead.name },
              {
                key: "costs",
                header: "Costing",
                render: (r) => (r.costs.length > 0 ? "Complete" : "Missing"),
              },
              {
                key: "actions",
                header: "Next step",
                align: "right",
                render: () => (
                  <Link href={ROUTES.work.tasks} className="btn btn-ghost btn-sm">
                    My Tasks
                  </Link>
                ),
              },
            ]}
            rows={designsQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No approved designs in production queue"
            emptyDescription="Designs appear here after management approval. Release is completed on My Tasks."
          />
        </div>
      </QueryState>

      <QueryState
        isLoading={releasedQuery.isLoading}
        isError={releasedQuery.isError}
        error={releasedQuery.error}
        onRetry={() => releasedQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card">
          <div className="card-header">
            <span className="card-title">Awaiting Go-Live</span>
          </div>
          <DataTable
            columns={[
              {
                key: "ideaRef",
                header: "Design",
                render: (row) => (
                  <Link href={ROUTES.designs.detail(row.id)} className="data-table-link">
                    {row.ideaRef}
                  </Link>
                ),
              },
              { key: "collectionName", header: "Collection" },
              {
                key: "productType",
                header: "Product",
                render: (r) => r.productType?.name ?? "—",
              },
              {
                key: "designHead",
                header: "Design Head",
                render: (r) => r.designHead?.name ?? "—",
              },
              {
                key: "status",
                header: "Status",
                render: () => <StatusBadge status="PRODUCTION_RELEASED" />,
              },
              {
                key: "liveReview",
                header: "Live review",
                render: (row) =>
                  row.liveReviewCompleted ? (
                    <StatusBadge status="COMPLETED" label="Ready" />
                  ) : (
                    <StatusBadge status="CHECKING" label="Pending" />
                  ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => {
                  const availability = getMarkLiveAvailability(row.status, {
                    liveReviewCompleted: row.liveReviewCompleted,
                  });
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={markLive.isPending || !availability.available}
                        title={availability.reason}
                        onClick={() => markLive.mutate(row.id)}
                      >
                        Mark Live
                      </button>
                      {!availability.available && availability.reason ? (
                        <span className="text-xs text-muted-foreground" style={{ maxWidth: "14rem", textAlign: "right" }}>
                          {availability.reason}
                        </span>
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
            rows={releasedQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No designs awaiting go-live"
            emptyDescription="Production-released designs will appear here for final live marking."
          />
        </div>
      </QueryState>

      <QueryState
        isLoading={handoffsQuery.isLoading}
        isError={handoffsQuery.isError}
        error={handoffsQuery.error}
        onRetry={() => handoffsQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <span className="card-title">ERP Handoffs (Grey / Cutting / Sales)</span>
          </div>
          <DataTable
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row) => (
                  <Link href={ROUTES.designs.detail(row.design.id)} className="data-table-link">
                    {row.design.ideaRef}
                  </Link>
                ),
              },
              { key: "erpModule", header: "Module" },
              { key: "designNumber", header: "Design No." },
              {
                key: "status",
                header: "Sync Status",
                render: (row) => <StatusBadge status={row.status} />,
              },
              { key: "erpReference", header: "ERP Ref", render: (r) => r.erpReference ?? "—" },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) =>
                  row.status === "FAILED" || row.status === "QUEUED" ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={retrySync.isPending}
                      onClick={() => retrySync.mutate(row.id)}
                    >
                      Retry sync
                    </button>
                  ) : null,
              },
            ]}
            rows={handoffsQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No ERP handoffs yet"
            emptyDescription="Handoffs are created when designs are released to production."
          />
        </div>
      </QueryState>
    </div>
  );
}
