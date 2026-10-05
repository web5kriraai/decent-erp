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

function designSearchText(row: DesignSummary) {
  return `${row.ideaRef} ${row.collectionName} ${row.productType?.name ?? ""} ${row.designHead?.name ?? ""}`;
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
        placeholder: "Search idea ref or collection…",
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
            key: "ideaRef",
            header: "Ref",
            render: (row) => (
              <button
                type="button"
                className="data-table-link"
                onClick={() => detailModal?.openDesign(row.id)}
              >
                {row.ideaRef}
              </button>
            ),
          },
          { key: "collectionName", header: "Design" },
          {
            key: "product",
            header: "Product",
            render: (row) => row.productType?.name ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "owner",
            header: "Owner",
            render: (row) => row.designHead?.name ?? "—",
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
