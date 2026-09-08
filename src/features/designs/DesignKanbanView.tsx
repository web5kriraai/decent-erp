"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesignKanban } from "@/hooks/use-designs";
import { useProductTypes, useSeasons } from "@/hooks/use-masters";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";
import { PERMISSIONS } from "@/lib/permissions";
import type { KanbanDesignItem, Priority } from "@/lib/types/api";

/** Seven dashboard lanes mapped from real workflow stage codes. */
const WORKFLOW_LANES = [
  {
    id: "new_idea",
    label: "New Idea",
    codes: ["CONCEPT_REVIEW", "CONCEPT"],
  },
  {
    id: "sketch",
    label: "Sketch",
    codes: ["SKETCH", "SKETCH_APPROVAL"],
  },
  {
    id: "punching",
    label: "Punching",
    codes: ["PUNCH", "PUNCH_CHECK"],
  },
  {
    id: "machine_sample",
    label: "Machine Sample",
    codes: [
      "MACHINE_SAMPLE",
      "SAMPLE_CUTTING",
      "SAMPLE_STITCHING",
      "SAMPLE_RECEIVE",
      "SAMPLE_CHECK",
      "MAT_REQ",
      "FABRIC_ISSUE",
    ],
  },
  {
    id: "correction",
    label: "Correction",
    codes: ["CORRECTION"],
  },
  {
    id: "final_approval",
    label: "Final Approval",
    codes: ["COSTING", "FINAL_APPROVAL"],
  },
  {
    id: "production_release",
    label: "Production Release",
    codes: [
      "PROD_HANDOFF",
      "PROD_INSTRUCTION",
      "PROD_RELEASE",
      "LIVE_REVIEW",
      "DONE",
    ],
  },
] as const;

type LaneId = (typeof WORKFLOW_LANES)[number]["id"];

const PRIORITY_FILTER_OPTIONS: { value: Priority | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Priority" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

function resolveLaneId(design: KanbanDesignItem): LaneId {
  if (
    (design.openCorrectionCount ?? 0) > 0 ||
    design.status === "ON_HOLD" ||
    (design.workflow.currentStageCode ?? "").includes("CORRECTION") ||
    (design.currentStage ?? "").includes("CORRECTION")
  ) {
    return "correction";
  }

  if (
    ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(
      design.status,
    )
  ) {
    return "production_release";
  }

  if (design.status === "APPROVAL_PENDING") {
    return "final_approval";
  }

  const code = (
    design.workflow.currentStageCode ??
    design.currentStage ??
    ""
  ).toUpperCase();

  if (!code || design.status === "DRAFT") {
    return "new_idea";
  }

  for (const lane of WORKFLOW_LANES) {
    if (lane.id === "correction") continue;
    if (lane.codes.some((c) => code === c || code.startsWith(`${c}_`))) {
      return lane.id;
    }
    if (lane.id === "machine_sample" && code.startsWith("SAMPLE_")) {
      return "machine_sample";
    }
    if (lane.id === "production_release" && code.startsWith("PROD_")) {
      return "production_release";
    }
  }

  if (code.includes("SKETCH")) return "sketch";
  if (code.includes("PUNCH")) return "punching";
  if (code.includes("COST") || code.includes("APPROVAL")) return "final_approval";

  return "new_idea";
}

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
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
  const productCode = design.productType?.code ?? design.productType?.name ?? "?";
  const costLabel = formatInr(design.estimatedCost);

  return (
    <article
      className="workflow-dash-card"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(design.id) : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(design.id);
              }
            }
          : undefined
      }
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
            <span>{String(productCode).slice(0, 4)}</span>
          </div>
        )}
        <div className="workflow-dash-card__badges">
          <span className="workflow-dash-card__stage">{laneLabel}</span>
          <PriorityBadge priority={design.priority} />
        </div>
      </div>

      <div className="workflow-dash-card__body">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="workflow-dash-card__ref text-left"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(design.id);
            }}
          >
            {design.ideaRef}
          </button>
          <Link
            href={ROUTES.designs.detail(design.id)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Full page
          </Link>
        </div>
        <p className="workflow-dash-card__title">{design.collectionName}</p>

        <dl className="workflow-dash-card__meta">
          <div>
            <dt>Product</dt>
            <dd>{design.productType?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Season</dt>
            <dd>{design.season?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{design.designHead?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{formatDueDate(design.dueAt)}</dd>
          </div>
        </dl>

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

        {costLabel ? (
          <p className="workflow-dash-card__cost">{costLabel}</p>
        ) : null}
      </div>
    </article>
  );
}

export function DesignKanbanView() {
  const detailModal = useOptionalDesignDetailModal();

  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const kanbanQuery = useDesignKanban(canView);
  const productTypes = useProductTypes(canView);
  const seasons = useSeasons(canView);

  const [productFilter, setProductFilter] = useState<string>("ALL");
  const [seasonFilter, setSeasonFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");

  const items = kanbanQuery.data?.items ?? [];
  const summary = kanbanQuery.data?.summary;

  const ownerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of items) {
      if (d.designHead?.name) names.add(d.designHead.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((d) => {
      if (productFilter !== "ALL" && d.productType?.name !== productFilter) return false;
      if (seasonFilter !== "ALL" && String(d.season?.id ?? "") !== seasonFilter) return false;
      if (ownerFilter !== "ALL" && d.designHead?.name !== ownerFilter) return false;
      if (priorityFilter !== "ALL" && d.priority !== priorityFilter) return false;
      return true;
    });
  }, [items, productFilter, seasonFilter, ownerFilter, priorityFilter]);

  const lanes = useMemo(() => {
    const map = Object.fromEntries(
      WORKFLOW_LANES.map((lane) => [lane.id, [] as KanbanDesignItem[]]),
    ) as Record<LaneId, KanbanDesignItem[]>;
    for (const design of filteredItems) {
      map[resolveLaneId(design)].push(design);
    }
    return WORKFLOW_LANES.map((lane) => ({
      ...lane,
      items: map[lane.id],
    }));
  }, [filteredItems]);

  const filtersActive =
    productFilter !== "ALL" ||
    seasonFilter !== "ALL" ||
    ownerFilter !== "ALL" ||
    priorityFilter !== "ALL";

  function resetFilters() {
    setProductFilter("ALL");
    setSeasonFilter("ALL");
    setOwnerFilter("ALL");
    setPriorityFilter("ALL");
  }

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Design Workflow Dashboard"
        subtitle="Idea to production release tracking for Saree, Suit, Kurti and Garments"
        actions={
          <div className="design-kanban-header-actions">
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
        skeletonVariant="pipeline-accordion"
      >
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
                : "—"
            }
            trend="Create → approved / released"
          />
        </div>

        <div className="workflow-dash-filters page-filters">
          <FormSelect
            id="wf-product"
            label="Product"
            value={productFilter === "ALL" ? "ALL" : productFilter}
            onValueChange={(v) => setProductFilter(v ?? "ALL")}
            options={[
              { value: "ALL", label: "All Products" },
              ...(productTypes.data ?? []).map((pt) => ({
                value: pt.name,
                label: pt.name,
              })),
            ]}
          />
          <FormSelect
            id="wf-season"
            label="Season"
            value={seasonFilter}
            onValueChange={(v) => setSeasonFilter(v ?? "ALL")}
            options={[
              { value: "ALL", label: "All Seasons" },
              ...(seasons.data ?? []).map((s) => ({
                value: String(s.id),
                label: s.name,
              })),
            ]}
          />
          <FormSelect
            id="wf-owner"
            label="Owner"
            value={ownerFilter}
            onValueChange={(v) => setOwnerFilter(v ?? "ALL")}
            options={[
              { value: "ALL", label: "All Owners" },
              ...ownerOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <FormSelect
            id="wf-priority"
            label="Priority"
            value={priorityFilter}
            onValueChange={(v) =>
              setPriorityFilter((v as Priority | "ALL") || "ALL")
            }
            options={PRIORITY_FILTER_OPTIONS}
          />
          <div className="workflow-dash-filters__actions">
            <AppButton
              type="button"
              appVariant="ghost"
              size="sm"
              disabled={!filtersActive}
              onClick={resetFilters}
            >
              Reset
            </AppButton>
            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">
              Open Reports
            </AppButtonLink>
          </div>
        </div>

        <div className="workflow-dash-board-scroll scroll-region">
          <div className="kanban kanban--workflow-dash" role="list">
            {lanes.map((lane) => (
              <section
                key={lane.id}
                className="kanban-column"
                role="listitem"
                aria-label={`${lane.label}, ${lane.items.length} designs`}
              >
                <div className="kanban-column-header">
                  <span className="kanban-column-title">
                    <span
                      className={`workflow-dash-dot workflow-dash-dot--${lane.id}`}
                      aria-hidden
                    />
                    {lane.label}
                  </span>
                  <span className="kanban-column-count">{lane.items.length}</span>
                </div>
                <div className="kanban-cards scroll-region">
                  {lane.items.length === 0 ? (
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
      </QueryState>
    </div>
  );
}
