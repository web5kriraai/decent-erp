"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useApprovedDesigns,
  useMarkDesignLive,
  useReleasedDesigns,
  useReleaseToProduction,
} from "@/hooks/use-production";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";

export function ProductionReleaseView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);

  const designsQuery = useApprovedDesigns(canRelease);
  const releasedQuery = useReleasedDesigns(canRelease);
  const release = useReleaseToProduction();
  const markLive = useMarkDesignLive();

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
        title="Production Release"
        subtitle="Review approved designs and authorize handoff to production"
      />

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <span className="card-title">Awaiting Release</span>
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
                header: "",
                align: "right",
                render: (row) => (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={release.isPending || row.costs.length === 0}
                    onClick={() => release.mutate(row.id)}
                  >
                    Release
                  </button>
                ),
              },
            ]}
            rows={designsQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No designs awaiting release"
            emptyDescription="Approved designs with completed costing will appear here."
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
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={markLive.isPending}
                    onClick={() => markLive.mutate(row.id)}
                  >
                    Mark Live
                  </button>
                ),
              },
            ]}
            rows={releasedQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No designs awaiting go-live"
            emptyDescription="Production-released designs will appear here for final live marking."
          />
        </div>
      </QueryState>
    </div>
  );
}
