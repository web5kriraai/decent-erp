"use client";

import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ReleasedDesignForGoLive } from "@/hooks/use-production";
import { getMarkLiveAvailability } from "@/lib/action-availability";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveProductionContextActions } from "@/lib/workflow-actions";

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
  onMarkLive: (designId: string) => void;
}) {
  const canExecuteTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);

  return (
    <AppCard
      title="Awaiting go-live"
      className="production-desk-secondary-card"
      description={undefined}
    >
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
                      {reviewHref ? (
                        <AppButtonLink href={reviewHref} appVariant="ghost" size="sm">
                          Open live review
                        </AppButtonLink>
                      ) : null}
                      <span className="text-right text-xs text-muted-foreground">
                        Complete Live Design Review first
                      </span>
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
                  onClick={() => onMarkLive(row.id)}
                >
                  Mark Live
                </AppButton>
              );
            },
          },
        ]}
        rows={designs}
        getRowKey={(r) => r.id}
        emptyTitle="No designs awaiting go-live"
        emptyDescription="Production-released designs will appear here for final live marking."
      />
    </AppCard>
  );
}
