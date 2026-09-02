"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useApprovedDesigns,
  useErpIntegrationStatus,
  useMarkDesignLive,
  useProductionHandoffs,
  useReleasedDesigns,
  useRetryHandoffSync,
  useSyncDesignHandoffs,
} from "@/hooks/use-production";
import { getMarkLiveAvailability } from "@/lib/action-availability";
import { resolveProductionContextActions } from "@/lib/workflow-actions";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
function isSimulatedErpReference(ref: string | null | undefined): boolean {
  return !!ref && ref.startsWith("LOCAL-");
}

export function ProductionReleaseView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);

  const designsQuery = useApprovedDesigns(canRelease);
  const releasedQuery = useReleasedDesigns(canRelease);
  const markLive = useMarkDesignLive();
  const handoffsQuery = useProductionHandoffs(canRelease);
  const retrySync = useRetryHandoffSync();
  const erpStatusQuery = useErpIntegrationStatus(canRelease);
  const syncDesignHandoffs = useSyncDesignHandoffs();

  const erpMode = erpStatusQuery.data?.mode ?? "simulated";
  const handoffDesignIds = [...new Set((handoffsQuery.data ?? []).map((h) => h.design.id))];

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

      <AppCard title="ERP integration" className="stack-section">
        <p className="mb-3 text-sm">
          Mode:{" "}
          <StatusBadge
            status={erpMode === "live" ? "ACTIVE" : "CHECKING"}
            label={erpMode === "live" ? "Live ERP" : "Simulated (LOCAL-*)"}
          />
        </p>
        <p className="text-muted-inline m-0">
          {erpStatusQuery.data?.message ??
            "Configure ERP_API_BASE_URL for live Grey → Cutting → Sales → downstream module sync."}
        </p>
      </AppCard>

      <AppCard className="contextual-actions-wrap stack-section">
        <ContextualActionsPanel title="Production desk actions" actions={productionActions} />
      </AppCard>

      <AppCard title="How release works" className="stack-section">
        <ol className="m-0 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          <li>Design Head completes <strong>Production Handoff</strong> after management approval.</li>
          <li>Production Head completes <strong>Production Instruction</strong> on My Tasks.</li>
          <li>Production Head completes <strong>Production Release</strong> on My Tasks — this triggers ERP handoff.</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link href={ROUTES.work.tasks} className="data-table-link">Open My Tasks</Link>
        </p>
      </AppCard>

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard title="Approved — production workflow" className="stack-section">
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
                  <AppButtonLink href={ROUTES.work.tasks} appVariant="ghost" size="sm">
                    My Tasks
                  </AppButtonLink>
                ),
              },
            ]}
            rows={designsQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No approved designs in production queue"
            emptyDescription="Designs appear here after management approval. Release is completed on My Tasks."
          />
        </AppCard>
      </QueryState>

      <QueryState
        isLoading={releasedQuery.isLoading}
        isError={releasedQuery.isError}
        error={releasedQuery.error}
        onRetry={() => releasedQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard title="Awaiting Go-Live">
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
                    <div className="flex max-w-56 flex-col items-end gap-1">
                      <AppButton
                        type="button"
                        appVariant="primary"
                        size="sm"
                        disabled={markLive.isPending || !availability.available}
                        title={availability.reason}
                        onClick={() => markLive.mutate(row.id)}
                      >
                        Mark Live
                      </AppButton>
                      {!availability.available && availability.reason ? (
                        <span className="text-right text-xs text-muted-foreground">
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
        </AppCard>
      </QueryState>

      <QueryState
        isLoading={handoffsQuery.isLoading}
        isError={handoffsQuery.isError}
        error={handoffsQuery.error}
        onRetry={() => handoffsQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard
          title="ERP Handoffs (Grey / Cutting / Sales + downstream)"
          className="stack-section"
          headerAction={
            handoffDesignIds.length > 0 ? (
              <AppButton
                type="button"
                appVariant="secondary"
                size="sm"
                disabled={syncDesignHandoffs.isPending}
                onClick={() => syncDesignHandoffs.mutate(handoffDesignIds[0])}
              >
                Sync all modules (latest design)
              </AppButton>
            ) : null
          }
        >
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
              {
                key: "error",
                header: "Last error",
                render: (row) =>
                  row.payload?.error ? (
                    <span className="text-xs text-muted-foreground">{row.payload.error}</span>
                  ) : (
                    "—"
                  ),
              },
              { key: "erpReference", header: "ERP Ref", render: (r) => (
                <span className="inline-flex items-center gap-2">
                  <span>{r.erpReference ?? "—"}</span>
                  {isSimulatedErpReference(r.erpReference) ? (
                    <StatusBadge status="CHECKING" label="Simulated" />
                  ) : null}
                </span>
              ) },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) =>
                  row.status === "FAILED" || row.status === "QUEUED" ? (
                    <AppButton
                      type="button"
                      appVariant="secondary"
                      size="sm"
                      disabled={retrySync.isPending}
                      onClick={() => retrySync.mutate(row.id)}
                    >
                      Retry sync
                    </AppButton>
                  ) : null,
              },
            ]}
            rows={handoffsQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No ERP handoffs yet"
            emptyDescription="Handoffs are created when designs are released to production."
          />
        </AppCard>
      </QueryState>
    </div>
  );
}
