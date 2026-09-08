"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { AppButtonLink } from "@/components/ui/AppButton";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowBoardCard } from "@/components/ui/WorkflowBoardCard";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";
import { masterDisplayName } from "@/lib/master-display";
import { queryKeys } from "@/lib/query-keys";

type SampleKanbanItem = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  currentStage: string | null;
  sampleDecision: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  productType: { name: string; code?: string };
  primaryImageUrl?: string | null;
  laneId: string;
};

type SampleKanbanBoard = {
  lanes: Array<{ id: string; label: string }>;
  counts: Record<string, number>;
  items: SampleKanbanItem[];
  summary: {
    total: number;
    pendingDecision: number;
    pass: number;
    hold: number;
    reject: number;
  };
};

export function SampleKanbanView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const detailModal = useOptionalDesignDetailModal();

  const boardQuery = useQuery({
    queryKey: queryKeys.designs.sampleKanban,
    queryFn: () => apiGet<SampleKanbanBoard>("/api/designs/sample-kanban"),
    enabled: canView,
  });

  const byLane = useMemo(() => {
    const map = new Map<string, SampleKanbanItem[]>();
    for (const item of boardQuery.data?.items ?? []) {
      const list = map.get(item.laneId) ?? [];
      list.push(item);
      map.set(item.laneId, list);
    }
    return map;
  }, [boardQuery.data?.items]);

  const summary = boardQuery.data?.summary;

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide workflow-dash-page">
      <PageHeader
        title="Sample Kanban"
        subtitle="Commercial sample Pass / Hold / Reject board"
        actions={
          <AppButtonLink href={ROUTES.designs.list} appVariant="secondary" size="sm">
            All designs
          </AppButtonLink>
        }
      />

      <QueryState
        isLoading={boardQuery.isLoading}
        isError={boardQuery.isError}
        error={boardQuery.error}
        onRetry={() => boardQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="workflow-dash-body">
          <div className="stat-grid stack-section workflow-dash-stats">
            <StatCard label="In board" value={summary?.total ?? 0} />
            <StatCard label="Pending decision" value={summary?.pendingDecision ?? 0} />
            <StatCard label="Pass" value={summary?.pass ?? 0} tone="success" />
            <StatCard label="Hold" value={summary?.hold ?? 0} tone="warning" />
            <StatCard label="Reject" value={summary?.reject ?? 0} />
          </div>

          <div className="workflow-dash-board-shell">
            <div
              className="workflow-dash-board-scroll"
              role="region"
              aria-label="Sample kanban lanes"
              tabIndex={0}
            >
            <div
              className="kanban kanban--workflow-dash"
              role="list"
              aria-label="Sample kanban lanes"
            >
              {(boardQuery.data?.lanes ?? []).map((lane) => {
                const cards = byLane.get(lane.id) ?? [];
                return (
                  <section key={lane.id} className="kanban-column" role="listitem">
                    <div className="kanban-column-header">
                      <span className="kanban-column-title">{lane.label}</span>
                      <span className="kanban-column-count">{cards.length}</span>
                    </div>
                    <div className="kanban-cards">
                      {cards.length === 0 ? (
                        <p className="workflow-dash-empty">Empty</p>
                      ) : (
                        cards.map((design) => {
                          const productLabel = masterDisplayName(
                            design.productType?.name,
                            design.productType?.code,
                          );
                          const stageLabel = (design.currentStage ?? "—").replace(
                            /_/g,
                            " ",
                          );
                          return (
                            <WorkflowBoardCard
                              key={design.id}
                              ideaRef={design.ideaRef}
                              title={design.collectionName}
                              laneLabel={lane.label}
                              priority={design.priority}
                              productType={design.productType}
                              primaryImageUrl={design.primaryImageUrl}
                              detailHref={ROUTES.designs.detail(design.id)}
                              onOpenCard={() => detailModal?.openDesign?.(design.id)}
                              meta={[
                                { label: "Product", value: productLabel },
                                { label: "Stage", value: stageLabel },
                              ]}
                              footer={
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge
                                    status={design.sampleDecision ?? "PENDING"}
                                  />
                                </div>
                              }
                            />
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
