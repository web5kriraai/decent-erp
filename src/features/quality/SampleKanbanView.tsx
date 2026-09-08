"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";
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
  const canView =
    permissions.includes(PERMISSIONS.DESIGN_CREATE) ||
    permissions.includes(PERMISSIONS.TASK_EXECUTE) ||
    permissions.includes(PERMISSIONS.KPI_ADMIN);
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

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  const summary = boardQuery.data?.summary;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Sample Kanban"
        subtitle="Concept → sample stages → Pass / Hold / Reject from sampleDecision + current stage."
        actions={
          <div className="flex flex-wrap gap-2">
            <AppButtonLink href={ROUTES.work.samples} appVariant="secondary" size="sm">
              Sample queue
            </AppButtonLink>
            <AppButtonLink href={ROUTES.designs.kanban} appVariant="ghost" size="sm">
              Workflow kanban
            </AppButtonLink>
          </div>
        }
      />

      <QueryState
        isLoading={boardQuery.isLoading}
        isError={boardQuery.isError}
        error={boardQuery.error}
        onRetry={() => boardQuery.refetch()}
        skeletonVariant="stats"
      >
        <div className="stat-grid stack-section">
          <StatCard label="In board" value={summary?.total ?? 0} />
          <StatCard label="Pending decision" value={summary?.pendingDecision ?? 0} />
          <StatCard label="Pass" value={summary?.pass ?? 0} tone="success" />
          <StatCard label="Hold" value={summary?.hold ?? 0} tone="warning" />
          <StatCard label="Reject" value={summary?.reject ?? 0} />
        </div>

        <div className="workflow-dash-board" role="list" aria-label="Sample kanban lanes">
          {(boardQuery.data?.lanes ?? []).map((lane) => {
            const cards = byLane.get(lane.id) ?? [];
            return (
              <section key={lane.id} className="workflow-dash-lane" role="listitem">
                <header className="workflow-dash-lane__head">
                  <h2 className="workflow-dash-lane__title">{lane.label}</h2>
                  <span className="workflow-dash-lane__count">{cards.length}</span>
                </header>
                <div className="workflow-dash-lane__cards">
                  {cards.length === 0 ? (
                    <p className="m-0 text-xs text-muted-foreground">Empty</p>
                  ) : (
                    cards.map((design) => (
                      <article
                        key={design.id}
                        className="workflow-dash-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => detailModal?.openDesign?.(design.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            detailModal?.openDesign?.(design.id);
                          }
                        }}
                      >
                        <div className="workflow-dash-card__visual">
                          {design.primaryImageUrl ? (
                            <img
                              src={design.primaryImageUrl}
                              alt=""
                              className="workflow-dash-card__img"
                            />
                          ) : (
                            <div className="workflow-dash-card__fallback" aria-hidden>
                              <span>
                                {(design.productType.code ?? design.productType.name).slice(0, 4)}
                              </span>
                            </div>
                          )}
                          <div className="workflow-dash-card__badges">
                            <span className="workflow-dash-card__stage">{lane.label}</span>
                            <PriorityBadge priority={design.priority} />
                          </div>
                        </div>
                        <div className="workflow-dash-card__body">
                          <Link
                            href={ROUTES.designs.detail(design.id)}
                            className="workflow-dash-card__ref"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {design.ideaRef}
                          </Link>
                          <p className="workflow-dash-card__meta m-0">{design.collectionName}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={design.sampleDecision ?? "PENDING"} />
                            <span className="text-xs text-muted-foreground">
                              {(design.currentStage ?? "—").replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
