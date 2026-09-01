"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { IconPlus, IconSearch } from "@/components/icons";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
import type { DesignSummary } from "@/lib/types/api";

const STATUS_FILTERS = ["ALL", "DRAFT", "ACTIVE", "APPROVAL_PENDING", "APPROVED", "ON_HOLD"];

export function DesignListView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  return (
    <div className="page-shell">
      <PageHeader
        title="Design Concepts"
        subtitle="Manage idea-to-release design pipeline"
        actions={
          <Link href={ROUTES.designs.new} className="btn btn-primary">
            <IconPlus size={16} />
            New Design
          </Link>
        }
      />

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
      >
        <DataTable<DesignSummary & Record<string, unknown>>
          columns={[
            {
              key: "ideaRef",
              header: "Idea Ref",
              render: (row) => (
                <Link href={ROUTES.designs.detail(row.id)} className="data-table-link">
                  {row.ideaRef}
                </Link>
              ),
            },
            { key: "collectionName", header: "Collection" },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "priority",
              header: "Priority",
              render: (row) => <PriorityBadge priority={row.priority} />,
            },
          ]}
          rows={filtered as (DesignSummary & Record<string, unknown>)[]}
          getRowKey={(row) => row.id}
          emptyTitle="No designs match your filters"
          emptyDescription="Create a new design concept or adjust search filters."
          emptyAction={
            <Link href={ROUTES.designs.new} className="btn btn-primary">
              <IconPlus size={16} />
              New Design
            </Link>
          }
          toolbar={
            <div className="page-toolbar">
              <div className="toolbar-search">
                <span className="toolbar-search-icon">
                  <IconSearch size={16} />
                </span>
                <input
                  type="search"
                  className="form-input"
                  placeholder="Search idea ref or collection…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search designs"
                />
              </div>
              <select
                className="form-select page-toolbar-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <span className="toolbar-count">
                {filtered.length} of {designsQuery.data?.total ?? 0} records
              </span>
            </div>
          }
        />
      </QueryState>
    </div>
  );
}
