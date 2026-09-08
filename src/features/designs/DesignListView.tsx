"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { AppButtonLink } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { IconPlus, IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
import type { DesignSummary } from "@/lib/types/api";
import { useOptionalDesignDetailModal } from "@/features/designs/DesignDetailModalProvider";
import { pipelineStatusLabel } from "@/lib/pipeline-status-theme";

const STATUS_FILTERS = ["ALL", "DRAFT", "ACTIVE", "APPROVAL_PENDING", "APPROVED", "ON_HOLD"];

export function DesignListView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const detailModal = useOptionalDesignDetailModal();
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
        title="Concept Board"
        subtitle="Idea register, references, voice notes and approvals for new concepts"
        actions={
          <AppButtonLink href={ROUTES.designs.new} appVariant="primary" size="sm">
            <IconPlus size={16} />
            New Design Concept
          </AppButtonLink>
        }
      />

      <div className="board-action-grid">
        <Link href={ROUTES.designs.new} className="board-action-card">
          <p className="board-action-card-title">Reference Gallery</p>
          <p className="board-action-card-desc">
            Attach images, video and documents while creating a concept.
          </p>
        </Link>
        <Link href={ROUTES.designs.new} className="board-action-card">
          <p className="board-action-card-title">Voice Notes</p>
          <p className="board-action-card-desc">
            Record or upload voice notes on the concept media panel.
          </p>
        </Link>
        {/* Scope freeze: create stays slim; orphans + style/theme/celebrity FKs deferred to Edit. */}
        <Link href={ROUTES.designs.new} className="board-action-card">
          <p className="board-action-card-title">Product Components</p>
          <p className="board-action-card-desc">
            Add style, fabric, components and other details later from Edit Design.
          </p>
        </Link>
        <Link href={ROUTES.quality.approvals} className="board-action-card">
          <p className="board-action-card-title">Idea Approvals</p>
          <p className="board-action-card-desc">
            Review pending management and stage approvals.
          </p>
        </Link>
      </div>

      <PageToolbar>
        <div className="toolbar-search">
          <span className="toolbar-search-icon">
            <IconSearch size={16} />
          </span>
          <Input
            type="search"
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
            placeholder="Search idea ref or collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search designs"
          />
        </div>
        <FormSelect
          id="design-status-filter"
          label=""
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_FILTERS.map((s) => ({
            value: s,
            label: s === "ALL" ? "All statuses" : pipelineStatusLabel(s),
          }))}
          triggerClassName="page-toolbar-select"
        />
        <span className="toolbar-count">
          {filtered.length} of {designsQuery.data?.total ?? 0} ideas
        </span>
        <AppButtonLink href={ROUTES.dashboard} appVariant="outline" size="sm">
          Workflow Dashboard
        </AppButtonLink>
      </PageToolbar>

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
              header: "Stage",
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
          ]}
          rows={filtered as (DesignSummary & Record<string, unknown>)[]}
          getRowKey={(row) => row.id}
          emptyTitle="No designs match your filters"
          emptyAction={
            <AppButtonLink href={ROUTES.designs.new} appVariant="primary">
              <IconPlus size={16} />
              New Design Concept
            </AppButtonLink>
          }
        />
      </QueryState>
    </div>
  );
}
