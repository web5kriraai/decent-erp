"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { AppButtonLink } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { IconPlus, IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
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

export function DesignListView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const detailModal = useOptionalDesignDetailModal();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const designsQuery = useDesignsList(permissions.includes(PERMISSIONS.DESIGN_CREATE));

  const filtered = useMemo(() => {
    if (!designsQuery.data?.items) return [];
    return designsQuery.data.items.filter((row) => {
      const matchSearch =
        !search ||
        row.ideaRef.toLowerCase().includes(search.toLowerCase()) ||
        row.collectionName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [designsQuery.data, search, statusFilter]);

  if (!permissions.includes(PERMISSIONS.DESIGN_CREATE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  const statusItems = Object.fromEntries(
    STATUS_FILTERS.map((s) => [s, STATUS_LABELS[s]]),
  );

  return (
    <div className="page-shell concept-board-page">
      <PageHeader
        title="Concept Board"
        className="concept-board-page__header"
        actions={
          <AppButtonLink href={ROUTES.designs.new} appVariant="primary" size="sm">
            <IconPlus size={16} />
            New Design Concept
          </AppButtonLink>
        }
      />

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
        skeletonVariant="table"
      >
        <DataTable<DesignSummary & Record<string, unknown>>
          className="!space-y-2"
          toolbar={
            <>
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <IconSearch
                  size={16}
                  className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search idea ref or collection…"
                  className="pl-8"
                  aria-label="Search designs"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  if (v != null) setStatusFilter(String(v));
                }}
                items={statusItems}
              >
                <SelectTrigger
                  id="design-status-filter"
                  aria-label="Filter by status"
                  className="h-8 min-w-[10rem]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="start">
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="toolbar-count">
                {filtered.length} of {designsQuery.data?.total ?? 0}
              </span>
              <AppButtonLink href={ROUTES.dashboard} appVariant="outline" size="sm">
                Workflow Dashboard
              </AppButtonLink>
            </>
          }
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
          rows={filtered as (DesignSummary & Record<string, unknown>)[]}
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
      </QueryState>
    </div>
  );
}
