"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import { useDesignKanban, useUpdateDesignStatus } from "@/hooks/use-designs";
import { PERMISSIONS } from "@/lib/permissions";
import type { KanbanDesignItem } from "@/lib/types/api";

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

function formatStageStatus(status: string | null): string {
  if (!status) return "";
  return status.replace(/_/g, " ");
}

function KanbanCardWorkflow({ design }: { design: KanbanDesignItem }) {
  const { workflow } = design;
  const hasWorkflow = workflow.totalStages > 0;
  const stageLabel =
    workflow.currentStage ??
    (hasWorkflow ? "Workflow not started" : "No workflow tasks");

  return (
    <div className="task-card-workflow">
      <div className="task-card-workflow-head">
        <span className="task-card-stage">{stageLabel}</span>
        {workflow.currentStatus ? (
          <StatusBadge
            status={workflow.currentStatus.toUpperCase().replace(/ /g, "_")}
            label={formatStageStatus(workflow.currentStatus)}
          />
        ) : null}
      </div>

      {workflow.currentOwner ? (
        <p className="task-card-workflow-owner">Owner: {workflow.currentOwner}</p>
      ) : null}

      {hasWorkflow ? (
        <p className="task-card-progress">
          {workflow.completedStages} / {workflow.totalStages} stages complete
        </p>
      ) : null}

      {workflow.activeStages.length > 1 ? (
        <ul className="task-card-active-stages">
          {workflow.activeStages.map((stage) => (
            <li key={`${stage.label}-${stage.status}`}>
              <span>{stage.label}</span>
              {stage.assigneeName ? (
                <span className="text-caption-muted"> · {stage.assigneeName}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {workflow.summary ? (
        <p className="task-card-workflow-summary">{workflow.summary}</p>
      ) : null}
    </div>
  );
}

export function DesignKanbanView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const kanbanQuery = useDesignKanban(permissions.includes(PERMISSIONS.DESIGN_CREATE));
  const updateStatus = useUpdateDesignStatus();
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLUMNS.map((s) => [s, [] as KanbanDesignItem[]])) as Record<
      string,
      KanbanDesignItem[]
    >;
    for (const design of kanbanQuery.data ?? []) {
      if (map[design.status]) map[design.status].push(design);
    }
    return map;
  }, [kanbanQuery.data]);

  function handleDrop(status: string) {
    if (!dragId) return;
    const design = kanbanQuery.data?.find((d) => d.id === dragId);
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
        subtitle="Kanban view by lifecycle status with current workflow stage on each card"
        actions={
          <AppButtonLink href={ROUTES.designs.list} appVariant="secondary" size="sm">
            Table view
          </AppButtonLink>
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
                      <KanbanCardWorkflow design={design} />
                      <div className="task-card-meta">
                        <span className="text-caption-muted">
                          {design.productType.name}
                        </span>
                        <PriorityBadge priority={design.priority} />
                      </div>
                      <p className="text-caption-muted mt-2 mb-0">
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
