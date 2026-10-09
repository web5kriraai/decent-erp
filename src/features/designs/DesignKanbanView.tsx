"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
import {
  WorkflowBoardCard,
  buildProductSeasonOwnerDueMeta,
} from "@/components/ui/WorkflowBoardCard";
import { ROUTES } from "@/config/routes";
import { useDesignKanban } from "@/hooks/use-designs";
import {
  WORKFLOW_LANES,
  compareBoardCards,
  resolveLaneId,
  type WorkflowLaneId,
} from "@/lib/workflow-lanes";
import { RoleDayScore } from "@/features/dashboard/RoleDayScore";
import { useHorizontalMouseScroll } from "@/hooks/use-horizontal-mouse-scroll";
import { useProductTypes, useSeasons } from "@/hooks/use-masters";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";
import { PERMISSIONS } from "@/lib/permissions";
import type { KanbanDesignItem, Priority } from "@/lib/types/api";

const PRIORITY_FILTER_OPTIONS: { value: Priority | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Priority" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "URGENT", label: "Urgent" },
];

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatInr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function WorkflowDesignCard({
  design,
  laneLabel,
  onOpen,
}: {
  design: KanbanDesignItem;
  laneLabel: string;
  onOpen?: (designId: string) => void;
}) {
  const progress =
    design.workflow.totalStages > 0
      ? Math.round(
          (design.workflow.completedStages / design.workflow.totalStages) * 100,
        )
      : 0;
  const costLabel = formatInr(design.estimatedCost);

  return (
    <WorkflowBoardCard
      ideaRef={design.ideaRef}
      title={design.collectionName}
      laneLabel={laneLabel}
      priority={design.priority}
      productType={design.productType}
      primaryImageUrl={design.primaryImageUrl}
      detailHref={ROUTES.designs.detail(design.id)}
      onOpenCard={onOpen ? () => onOpen(design.id) : undefined}
      meta={buildProductSeasonOwnerDueMeta({
        productType: design.productType,
        seasonName: design.season?.name,
        ownerName: design.designHead?.name,
        dueLabel: formatDueDate(design.dueAt),
      })}
      footer={
        <>
          {design.workflow.totalStages > 0 ? (
            <div className="workflow-dash-card__progress">
              <div className="workflow-dash-card__progress-label">
                <span>{progress}% complete</span>
                <span>
                  {design.workflow.completedStages}/{design.workflow.totalStages}
                </span>
              </div>
              <div className="workflow-dash-card__progress-track" aria-hidden>
                <div
                  className="workflow-dash-card__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}
          {design.workflow.currentOwner ? (
            <p className="m-0 text-xs text-muted-foreground">
              {design.workflow.pendingApproval
                ? `Pending approval with ${design.workflow.currentOwner}`
                : `Assigned to ${design.workflow.currentOwner}`}
              {design.workflow.currentStage ? ` · ${design.workflow.currentStage}` : ""}
            </p>
          ) : null}
          {costLabel ? (
            <p className="workflow-dash-card__cost">{costLabel}</p>
          ) : null}
        </>
      }
    />
  );
}

export function DesignKanbanView() {
  const detailModal = useOptionalDesignDetailModal();
  const boardScrollRef = useHorizontalMouseScroll<HTMLDivElement>();

  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const productTypes = useProductTypes(canView);
  const seasons = useSeasons(canView);

  const [productFilter, setProductFilter] = useState<string>("ALL");
  const [seasonFilter, setSeasonFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, productFilter, seasonFilter, ownerFilter, priorityFilter, pageSize]);

  const kanbanQuery = useDesignKanban(
    {
      page,
      pageSize,
      q: searchQuery,
      product: productFilter,
      seasonId: seasonFilter,
      owner: ownerFilter,
      priority: priorityFilter,
    },
    canView,
  );

  const items = kanbanQuery.data?.items ?? [];
  const summary = kanbanQuery.data?.summary;
  const laneCounts = kanbanQuery.data?.laneCounts;
  const pagination = kanbanQuery.data?.pagination;

  const ownerOptions = kanbanQuery.data?.owners ?? [];

  const lanes = useMemo(() => {
    const map = Object.fromEntries(
      WORKFLOW_LANES.map((lane) => [lane.id, [] as KanbanDesignItem[]]),
    ) as Record<WorkflowLaneId, KanbanDesignItem[]>;
    for (const design of items) {
      map[resolveLaneId(design)].push(design);
    }
    return WORKFLOW_LANES.map((lane) => ({
      ...lane,
      total: laneCounts?.[lane.id] ?? map[lane.id].length,
      items: map[lane.id].sort(compareBoardCards),
    }));
  }, [items, laneCounts]);

  const filtersActive =
    productFilter !== "ALL" ||
    seasonFilter !== "ALL" ||
    ownerFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    searchInput.trim().length > 0;

  function resetFilters() {
    setProductFilter("ALL");
    setSeasonFilter("ALL");
    setOwnerFilter("ALL");
    setPriorityFilter("ALL");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide workflow-dash-page">
      <PageHeader
        title="Design Workflow Dashboard"
        actions={
          <div className="design-kanban-header-actions">
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="outline" size="sm">
              Open Reports
            </AppButtonLink>
            <AppButtonLink href={ROUTES.designs.new} appVariant="primary" size="sm">
              + New Design Concept
            </AppButtonLink>
          </div>
        }
      />

      <QueryState
        isLoading={kanbanQuery.isLoading}
        isError={kanbanQuery.isError}
        error={kanbanQuery.error}
        onRetry={() => kanbanQuery.refetch()}
        skeletonVariant="workflow-dashboard"
      >
        <div className="workflow-dash-body">
        <RoleDayScore compact />
        <div className="stat-grid workflow-dash-stats">
          <StatCard
            label="Total Ideas"
            value={summary?.totalIdeas ?? 0}
            tone="accent"
            trend={
              summary
                ? `↑ ${summary.createdThisMonth} this month`
                : undefined
            }
          />
          <StatCard
            label="Under Development"
            value={summary?.underDevelopment ?? 0}
            trend={
              summary
                ? `${summary.highPriorityInDev} priority designs`
                : undefined
            }
          />
          <StatCard
            label="Correction Pending"
            value={summary?.correctionPending ?? 0}
            tone={(summary?.correctionPending ?? 0) > 0 ? "warning" : "default"}
            trend={
              summary ? `${summary.delayedCount} delayed` : undefined
            }
          />
          <StatCard
            label="Approved Designs"
            value={summary?.approvedCount ?? 0}
            tone="success"
            trend={
              summary ? `${summary.approvalRate}% approval rate` : undefined
            }
          />
          <StatCard
            label="Released to Production"
            value={summary?.releasedCount ?? 0}
            trend={
              summary && summary.estimatedCostSum > 0
                ? `${formatInr(summary.estimatedCostSum)} estimated`
                : undefined
            }
          />
          <StatCard
            label="Avg. Development Time"
            value={
              summary?.avgDevelopmentDays != null
                ? `${summary.avgDevelopmentDays}d`
                : "-"
            }
            trend="Create → approved / released"
          />
        </div>

        <div
          className="workflow-dash-filters list-filter-group"
          role="group"
          aria-label="Workflow filters"
        >
          <ListSearch
            id="wf-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search idea, product, owner…"
            aria-label="Search designs"
            className="workflow-dash-search"
          />
          <ListSelectFilter
            id="wf-product"
            label="Product"
            value={productFilter === "ALL" ? "ALL" : productFilter}
            onChange={(v) => setProductFilter(v || "ALL")}
            options={[
              { value: "ALL", label: "All Products" },
              ...(productTypes.data ?? []).map((pt) => ({
                value: pt.name,
                label: pt.name,
              })),
            ]}
          />
          <ListSelectFilter
            id="wf-season"
            label="Season"
            value={seasonFilter}
            onChange={(v) => setSeasonFilter(v || "ALL")}
            options={[
              { value: "ALL", label: "All Seasons" },
              ...(seasons.data ?? []).map((s) => ({
                value: String(s.id),
                label: s.name,
              })),
            ]}
          />
          <ListSelectFilter
            id="wf-owner"
            label="Owner"
            value={ownerFilter}
            onChange={(v) => setOwnerFilter(v || "ALL")}
            options={[
              { value: "ALL", label: "All Owners" },
              ...ownerOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <ListSelectFilter
            id="wf-priority"
            label="Priority"
            value={priorityFilter}
            onChange={(v) =>
              setPriorityFilter((v as Priority | "ALL") || "ALL")
            }
            options={PRIORITY_FILTER_OPTIONS}
          />
          <AppButton
            type="button"
            appVariant="ghost"
            size="sm"
            disabled={!filtersActive}
            onClick={resetFilters}
          >
            Reset
          </AppButton>
        </div>

        <div className="workflow-dash-board-shell">
          <div
            ref={boardScrollRef}
            className="workflow-dash-board-scroll"
            role="region"
            aria-label="Design workflow stages"
            tabIndex={0}
          >
          <div className="kanban kanban--workflow-dash" role="list">
            {lanes.map((lane) => (
              <section
                key={lane.id}
                className="kanban-column"
                role="listitem"
                aria-label={`${lane.label}, ${lane.total} designs`}
              >
                <div className="kanban-column-header">
                  <span className="kanban-column-title">
                    <span
                      className={`workflow-dash-dot workflow-dash-dot--${lane.id}`}
                      aria-hidden
                    />
                    {lane.label}
                  </span>
                  <span className="kanban-column-count">{lane.total}</span>
                </div>
                <div className="kanban-cards">
                  {lane.total === 0 ? (
                    <p className="workflow-dash-empty">No designs</p>
                  ) : (
                    lane.items.map((design) => (
                      <WorkflowDesignCard
                        key={design.id}
                        design={design}
                        laneLabel={lane.label}
                        onOpen={(id) => detailModal?.openDesign(id)}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
          </div>
        </div>
        <PaginationBar
          total={pagination?.total ?? 0}
          page={pagination?.page ?? page}
          pageSize={pagination?.pageSize ?? pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeSelectId="workflow-dash-page-size"
          className="list-page__pagination"
        />
        </div>
      </QueryState>
    </div>
  );
}
