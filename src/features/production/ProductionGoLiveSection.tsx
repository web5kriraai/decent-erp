"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
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
}: {
  designs: ReleasedDesignForGoLive[];
  roleCode: string | undefined;
  permissions: string[];
  markLivePending: boolean;
  onMarkLive: (designId: string) => Promise<unknown>;
}) {
  const canExecuteTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const [confirmDesign, setConfirmDesign] = useState<ReleasedDesignForGoLive | null>(null);
  const getSearchText = useCallback(goLiveSearchText, []);
  const list = useClientList({ items: designs, getSearchText });

  return (
    <>
      <div className="production-desk-secondary-card">
        <div className="production-desk-secondary-body">
        <div className="page-toolbar !mb-0 border-b px-3 py-2">
          <ListSearch
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search designs…"
            aria-label="Search awaiting go-live designs"
          />
        </div>
        <div className="production-desk-secondary-scroll">
        <DataTable
          flush
          columns={[
            {
              key: "ideaRef",
              header: "Design",
              render: (row) => {
                const meta = [row.ideaRef, row.productType?.name, row.designHead?.name]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link href={ROUTES.designs.detail(row.id)} className="concept-board-design">
                    <span className="concept-board-line" title={`${row.collectionName} · ${meta}`}>
                      <span className="concept-board-line__title data-table-link">
                        {row.collectionName}
                      </span>
                      <span className="data-table-subtext concept-board-line__meta">{meta}</span>
                    </span>
                  </Link>
                );
              },
            },
            {
              key: "liveReview",
              header: "Live review",
              className: "production-desk-golive-review",
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
              className: "production-desk-golive-next",
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
                    if (reviewHref) {
                      return (
                        <AppButtonLink href={reviewHref} appVariant="outline" size="sm">
                          Open live review
                        </AppButtonLink>
                      );
                    }
                    return (
                      <span className="production-desk-golive-note">
                        Waiting on live review
                      </span>
                    );
                  }
                  return null;
                }

                if (!availability.available) {
                  return (
                    <span className="production-desk-golive-note" title={availability.reason}>
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
        </div>
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
        </div>
      </div>

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
