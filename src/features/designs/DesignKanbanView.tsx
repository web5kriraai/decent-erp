"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { AppButtonLink } from "@/components/ui/AppButton";
import {
  PipelineAccordionBoard,
  type PipelineAccordionSection,
} from "@/components/ui/PipelineAccordionBoard";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesignKanban, useUpdateDesignStatus } from "@/hooks/use-designs";
import { pipelineStatusAccent, pipelineStatusLabel } from "@/lib/pipeline-status-theme";
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

function DesignPipelineCard({ design }: { design: KanbanDesignItem }) {
  const stageHint =
    design.workflow.currentStage ??
    (design.workflow.totalStages > 0 ? "In workflow" : null);

  return (
    <article className="pipeline-card">
      <Link href={ROUTES.designs.detail(design.id)} className="pipeline-card-ref">
        {design.ideaRef}
      </Link>
      <p className="pipeline-card-title">{design.collectionName}</p>
      {stageHint ? <p className="pipeline-card-stage">{stageHint}</p> : null}
      <div className="pipeline-card-foot">
        <span className="pipeline-card-owner">{design.designHead.name}</span>
        <PriorityBadge priority={design.priority} />
      </div>
    </article>
  );
}

export function DesignKanbanView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const kanbanQuery = useDesignKanban(permissions.includes(PERMISSIONS.DESIGN_CREATE));
  const updateStatus = useUpdateDesignStatus();
  const [dragId, setDragId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>("ACTIVE");

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

  const sections = useMemo((): PipelineAccordionSection<KanbanDesignItem>[] => {
    return KANBAN_COLUMNS.map((status, index) => ({
      id: status,
      label: pipelineStatusLabel(status),
      sequence: index + 1,
      accent: pipelineStatusAccent(status),
      items: grouped[status] ?? [],
    }));
  }, [grouped]);

  function toggleSection(sectionId: string) {
    setExpandedId((prev) => (prev === sectionId ? null : sectionId));
  }

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
        subtitle="Expand one lifecycle phase at a time — up to 15 designs shown per row"
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
        skeletonVariant="pipeline-accordion"
      >
        <PipelineAccordionBoard
          sections={sections}
          expandedId={expandedId}
          onToggle={toggleSection}
          onDragStart={setDragId}
          onDragEnd={() => setDragId(null)}
          onDrop={handleDrop}
          getItemId={(design) => design.id}
          renderCard={(design) => <DesignPipelineCard design={design} />}
          emptyLabel="No designs in this phase"
          previewLimit={15}
        />
      </QueryState>
    </div>
  );
}
