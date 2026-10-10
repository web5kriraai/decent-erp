"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { AppButtonLink } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { IconPlus } from "@/components/icons";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
import { useClientList } from "@/hooks/use-client-list";
import type { DesignSummary } from "@/lib/types/api";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";

const STATUS_FILTERS = ["ALL", "DRAFT", "ACTIVE", "APPROVAL_PENDING", "APPROVED", "ON_HOLD"] as const;

const STATUS_LABELS: Record<(typeof STATUS_FILTERS)[number], string> = {
  ALL: "All statuses",
  DRAFT: "Draft",
  ACTIVE: "Active",
  APPROVAL_PENDING: "Approval pending",
  APPROVED: "Approved",
  ON_HOLD: "On hold",
};

const STATUS_OPTIONS = STATUS_FILTERS.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

const STATUS_DISPLAY: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  APPROVAL_PENDING: "With Management",
  APPROVED: "Approved",
  PRODUCTION_ACCEPTED: "In production",
  PRODUCTION_RELEASED: "Released",
  REJECTED: "Rejected",
  LIVE: "Live",
  CLOSED: "Closed",
};

function BoardLine({
  title,
  meta,
  link,
}: {
  title: string;
  meta?: string | null;
  link?: boolean;
}) {
  return (
    <div className="concept-board-line" title={meta ? `${title} · ${meta}` : title}>
      <span className={link ? "concept-board-line__title data-table-link" : "concept-board-line__title"}>
        {title}
      </span>
      {meta ? <span className="data-table-subtext concept-board-line__meta">{meta}</span> : null}
    </div>
  );
}

function designSearchText(row: DesignSummary) {
  return [
    row.ideaRef,
    row.collectionName,
    row.productType?.name,
    row.designHead?.name,
    row.listMeta?.currentStageName,
    row.listMeta?.currentAssigneeName,
    row.listMeta?.pendingReviewerName,
  ]
    .filter(Boolean)
    .join(" ");
}

export function DesignListView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const detailModal = useOptionalDesignDetailModal();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const designsQuery = useDesignsList(permissions.includes(PERMISSIONS.DESIGN_CREATE));

  const statusFiltered = useMemo(() => {
    const items = designsQuery.data?.items ?? [];
    if (statusFilter === "ALL") return items;
    return items.filter((row) => row.status === statusFilter);
  }, [designsQuery.data?.items, statusFilter]);

  const getSearchText = useCallback(designSearchText, []);

  const list = useClientList({
    items: statusFiltered,
    getSearchText,
    filterKey: statusFilter,
  });

  if (!permissions.includes(PERMISSIONS.DESIGN_CREATE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  return (
    <ListPage
      title="Concept Board"
      subtitle="Each design, the stage it is on, and who has it now."
      className="concept-board-page"
      actions={
        <AppButtonLink href={ROUTES.designs.new} appVariant="primary" size="sm">
          <IconPlus size={16} />
          New Design Concept
        </AppButtonLink>
      }
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search idea, stage, or assignee…",
        "aria-label": "Search designs",
      }}
      filters={
        <ListSelectFilter
          id="design-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />
      }
      toolbarExtra={
        <>
          <span className="toolbar-count">
            {list.total} of {designsQuery.data?.total ?? 0}
          </span>
          <AppButtonLink href={ROUTES.dashboard} appVariant="outline" size="sm">
            Workflow Dashboard
          </AppButtonLink>
        </>
      }
      onRefresh={() => designsQuery.refetch()}
      isRefreshing={designsQuery.isFetching}
      query={{
        isLoading: designsQuery.isLoading,
        isError: designsQuery.isError,
        error: designsQuery.error,
        onRetry: () => designsQuery.refetch(),
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "designs-page-size",
      }}
    >
      <DataTable<DesignSummary & Record<string, unknown>>
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => {
              const product = row.productType?.name;
              const owner = row.designHead?.name;
              const meta = [row.ideaRef, product, owner ? `Owner ${owner}` : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  type="button"
                  className="concept-board-design"
                  onClick={() => detailModal?.openDesign(row.id)}
                >
                  <BoardLine title={row.collectionName} meta={meta} link />
                </button>
              );
            },
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <StatusBadge
                status={row.status}
                label={STATUS_DISPLAY[row.status] ?? row.status.replace(/_/g, " ")}
              />
            ),
          },
          {
            key: "stage",
            header: "Stage",
            render: (row) => {
              const stage = row.listMeta?.currentStageName?.trim() || "-";
              const manual = (row.listMeta?.assignmentMode ?? row.assignmentMode) === "MANUAL";
              return <BoardLine title={stage} meta={manual ? "Manual assignment" : null} />;
            },
          },
          {
            key: "with",
            header: "With",
            render: (row) => {
              const assignee = row.listMeta?.currentAssigneeName;
              const reviewer = row.listMeta?.pendingReviewerName;
              if (!assignee && !reviewer) return "-";
              return (
                <BoardLine
                  title={assignee ?? reviewer ?? "-"}
                  meta={
                    reviewer && reviewer !== assignee ? `Review ${reviewer}` : null
                  }
                />
              );
            },
          },
          {
            key: "corrections",
            header: "Corrections",
            render: (row) => {
              const open = row.listMeta?.openCorrectionCount ?? 0;
              const cycle = row.listMeta?.maxCorrectionCycle ?? 0;
              if (open === 0 && cycle === 0) return "-";
              return (
                <BoardLine
                  title={open === 1 ? "1 open" : `${open} open`}
                  meta={cycle > 0 ? `Cycle ${cycle}` : null}
                />
              );
            },
          },
          {
            key: "priority",
            header: "Priority",
            render: (row) => <PriorityBadge priority={row.priority} />,
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => (
              <TableIconActionGroup>
                <TableIconAction
                  action="edit"
                  label="Open design"
                  onClick={() => detailModal?.openDesign(row.id)}
                />
              </TableIconActionGroup>
            ),
          },
        ]}
        rows={list.pageItems as (DesignSummary & Record<string, unknown>)[]}
        getRowKey={(row) => row.id}
        emptyTitle="No designs match your filters"
        emptyDescription="Create a concept to get started."
        emptyAction={
          <AppButtonLink href={ROUTES.designs.new} appVariant="primary" size="sm">
            <IconPlus size={16} />
            New Design Concept
          </AppButtonLink>
        }
      />
    </ListPage>
  );
}
