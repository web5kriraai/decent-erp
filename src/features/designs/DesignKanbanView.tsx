"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import { useDesignKanban, useUpdateDesignStatus } from "@/hooks/use-designs";
import { PERMISSIONS } from "@/lib/permissions";

const KANBAN_COLUMNS = [
  "DRAFT",
  "ACTIVE",
  "ON_HOLD",
  "APPROVAL_PENDING",
  "APPROVED",
  "PRODUCTION_ACCEPTED",
  "PRODUCTION_RELEASED",
  "LIVE",
] as const;

type KanbanDesign = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  priority: string;
  version: number;
  productType: { name: string };
  designHead: { name: string };
};

export function DesignKanbanView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const kanbanQuery = useDesignKanban(permissions.includes(PERMISSIONS.DESIGN_CREATE));
  const updateStatus = useUpdateDesignStatus();
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLUMNS.map((s) => [s, [] as KanbanDesign[]])) as Record<
      string,
      KanbanDesign[]
    >;
    for (const design of (kanbanQuery.data ?? []) as KanbanDesign[]) {
      if (map[design.status]) map[design.status].push(design);
    }
    return map;
  }, [kanbanQuery.data]);

  function handleDrop(status: string) {
    if (!dragId) return;
    const design = (kanbanQuery.data as KanbanDesign[] | undefined)?.find((d) => d.id === dragId);
    if (!design || design.status === status) {
      setDragId(null);
      return;
    }
    updateStatus.mutate(
      { designId: design.id, status, version: design.version },
      { onSettled: () => setDragId(null) },
    );
  }

  if (!permissions.includes(PERMISSIONS.DESIGN_CREATE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Design Pipeline"
        subtitle="Kanban view of design concepts by lifecycle stage"
        actions={
          <Link href={ROUTES.designs.list} className="btn btn-secondary btn-sm">
            Table view
          </Link>
        }
      />

      <QueryState
        isLoading={kanbanQuery.isLoading}
        isError={kanbanQuery.isError}
        error={kanbanQuery.error}
        onRetry={() => kanbanQuery.refetch()}
        skeletonVariant="cards"
      >
        <div className="kanban">
          {KANBAN_COLUMNS.map((status) => (
            <section
              key={status}
              className="kanban-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(status)}
            >
              <header className="kanban-column-header">
                <StatusBadge status={status} />
                <span className="kanban-column-count">{grouped[status]?.length ?? 0}</span>
              </header>
              <div className="kanban-cards">
                {(grouped[status] ?? []).length === 0 ? (
                  <p className="kanban-empty">No designs</p>
                ) : (
                  (grouped[status] ?? []).map((design) => (
                    <article
                      key={design.id}
                      className="task-card"
                      draggable
                      onDragStart={() => setDragId(design.id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      <Link href={ROUTES.designs.detail(design.id)} className="task-card-ref">
                        {design.ideaRef}
                      </Link>
                      <p className="task-card-title">{design.collectionName}</p>
                      <div className="task-card-meta">
                        <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                          {design.productType.name}
                        </span>
                        <PriorityBadge priority={design.priority} />
                      </div>
                      <p
                        style={{
                          margin: "0.5rem 0 0",
                          fontSize: "var(--font-size-caption)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        {design.designHead.name}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
