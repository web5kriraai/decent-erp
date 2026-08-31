"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { useApprovedDesigns, useReleaseToProduction } from "@/hooks/use-production";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";

export function ProductionReleaseView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);

  const designsQuery = useApprovedDesigns(canRelease);
  const release = useReleaseToProduction();

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
        <div className="card">
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
    </div>
  );
}
