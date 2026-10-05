"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ReleasedDesignForGoLive } from "@/hooks/use-production";
import { getMarkLiveAvailability } from "@/lib/action-availability";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveProductionContextActions } from "@/lib/workflow-actions";
import { MarkLiveConfirm } from "@/features/production/MarkLiveConfirm";
import { useClientList } from "@/hooks/use-client-list";

function goLiveSearchText(row: ReleasedDesignForGoLive) {
  return `${row.ideaRef} ${row.collectionName} ${row.productType?.name ?? ""} ${row.designHead?.name ?? ""}`;
}

export function ProductionGoLiveSection({
  designs,
  roleCode,
  permissions,
  markLivePending,
  onMarkLive,
  onRefresh,
  isRefreshing,
}: {
  designs: ReleasedDesignForGoLive[];
  roleCode: string | undefined;
  permissions: string[];
  markLivePending: boolean;
  onMarkLive: (designId: string) => Promise<unknown>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const canExecuteTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const [confirmDesign, setConfirmDesign] = useState<ReleasedDesignForGoLive | null>(null);
  const getSearchText = useCallback(goLiveSearchText, []);
  const list = useClientList({ items: designs, getSearchText });

  return (
    <>
      <AppCard
        title="Awaiting go-live"
        className="production-desk-secondary-card overflow-visible"
        description={undefined}
        headerAction={
          onRefresh ? (
            <ListRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
          ) : null
        }
      >
        <div className="page-toolbar !mb-0 border-b px-3 py-2">
          <ListSearch
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search designs…"
            aria-label="Search awaiting go-live designs"
          />
        </div>
        <DataTable
          flush
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
              render: (r) => r.productType?.name ?? "-",
            },
            {
              key: "designHead",
              header: "Design Head",
              render: (r) => r.designHead?.name ?? "-",
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
                  roleCode,
                });
                const productionActions = resolveProductionContextActions({
                  permissions,
                  roleCode,
                  designStatus: row.status,
                  designId: row.id,
                  liveReviewCompleted: row.liveReviewCompleted,
                });
                const canShowMarkLive = productionActions.some(
                  (a) => a.code === "MARK_LIVE" && a.enabled,
                );

                if (!canShowMarkLive) {
                  if (!row.liveReviewCompleted) {
                    const reviewHref =
                      canExecuteTasks && row.liveReviewTaskId
                        ? ROUTES.work.taskDetail(row.liveReviewTaskId)
                        : null;
                    return (
                      <div className="flex max-w-56 flex-col items-end gap-1">
                        <span className="text-right text-xs text-muted-foreground">
                          Complete Live Design Review first
                        </span>
                        {reviewHref ? (
                          <AppButtonLink href={reviewHref} appVariant="ghost" size="sm">
                            Open live review
                          </AppButtonLink>
                        ) : null}
                      </div>
                    );
                  }
                  return null;
                }

                if (!availability.available) {
                  return (
                    <span className="text-right text-xs text-muted-foreground">
                      {availability.reason}
                    </span>
                  );
                }

                return (
                  <AppButton
                    type="button"
                    appVariant="primary"
                    size="sm"
                    disabled={markLivePending}
                    onClick={() => setConfirmDesign(row)}
                  >
                    Mark Live
                  </AppButton>
                );
              },
            },
          ]}
          rows={list.pageItems}
          getRowKey={(r) => r.id}
          emptyTitle="No designs awaiting go-live"
        />
        {list.total > 0 ? (
          <PaginationBar
            total={list.total}
            page={list.page}
            pageSize={list.pageSize}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            pageSizeSelectId="production-golive-page-size"
          />
        ) : null}
      </AppCard>

      <MarkLiveConfirm
        open={!!confirmDesign}
        design={confirmDesign}
        onClose={() => {
          if (!markLivePending) setConfirmDesign(null);
        }}
        isPending={markLivePending}
        onConfirm={() => {
          if (!confirmDesign || markLivePending) return;
          void onMarkLive(confirmDesign.id)
            .then(() => setConfirmDesign(null))
            .catch(() => {
              /* toast via mutation; keep dialog open for retry */
            });
        }}
      />
    </>
  );
}
