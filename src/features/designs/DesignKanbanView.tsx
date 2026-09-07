"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
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

/** Sample / production workflow stage lanes (sub-process codes). */
const STAGE_LANE_CODES = [
  "CONCEPT_REVIEW",
  "SKETCH",
  "SKETCH_APPROVAL",
  "PUNCH",
  "PUNCH_CHECK",
  "MAT_REQ",
  "FABRIC_ISSUE",
  "MACHINE_SAMPLE",
  "SAMPLE_CUTTING",
  "SAMPLE_STITCHING",
  "SAMPLE_RECEIVE",
  "SAMPLE_CHECK",
  "COSTING",
  "FINAL_APPROVAL",
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
] as const;

const STAGE_LANE_SET = new Set<string>(STAGE_LANE_CODES);

const DONE_STATUSES = new Set([
  "APPROVED",
  "PRODUCTION_ACCEPTED",
  "PRODUCTION_RELEASED",
  "LIVE",
]);

type KanbanViewMode = "status" | "stage";

function stageLaneLabel(code: string): string {
  if (code === "DONE") return "Done";
  if (code === "OTHER") return "Other";
  return code.replace(/_/g, " ");
}

function stageLaneAccent(code: string) {
  if (code === "DONE") return pipelineStatusAccent("APPROVED");
  if (code === "OTHER") return pipelineStatusAccent("ON_HOLD");
  if (code === "PROD_RELEASE" || code === "LIVE_REVIEW") {
    return pipelineStatusAccent("PRODUCTION_RELEASED");
  }
  return pipelineStatusAccent("ACTIVE");
}

function resolveStageLaneKey(design: KanbanDesignItem): string {
  const code = design.workflow.currentStageCode ?? design.currentStage ?? null;
  if (code && STAGE_LANE_SET.has(code)) return code;
  if (!code && DONE_STATUSES.has(design.status)) return "DONE";
  if (code) return "OTHER";
  return DONE_STATUSES.has(design.status) ? "DONE" : "OTHER";
}

function DesignPipelineCard({
  design,
  showStatusHint,
}: {
  design: KanbanDesignItem;
  showStatusHint?: boolean;
}) {
  const stageHint =
    design.workflow.currentStage ??
    (design.workflow.totalStages > 0 ? "In workflow" : null);
  const statusHint = showStatusHint ? pipelineStatusLabel(design.status) : null;

  return (
    <article className="pipeline-card">
      <Link href={ROUTES.designs.detail(design.id)} className="pipeline-card-ref">
        {design.ideaRef}
      </Link>
      <p className="pipeline-card-title">{design.collectionName}</p>
      {stageHint ? <p className="pipeline-card-stage">{stageHint}</p> : null}
      {statusHint ? <p className="pipeline-card-stage">{statusHint}</p> : null}
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
  const [viewMode, setViewMode] = useState<KanbanViewMode>("status");
  const [dragId, setDragId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>("ACTIVE");

  const statusGrouped = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLUMNS.map((s) => [s, [] as KanbanDesignItem[]])) as Record<
      string,
      KanbanDesignItem[]
    >;
    for (const design of kanbanQuery.data ?? []) {
      if (map[design.status]) map[design.status].push(design);
    }
    return map;
  }, [kanbanQuery.data]);

  const stageGrouped = useMemo(() => {
    const laneIds = [...STAGE_LANE_CODES, "OTHER", "DONE"] as const;
    const map = Object.fromEntries(laneIds.map((s) => [s, [] as KanbanDesignItem[]])) as Record<
      string,
      KanbanDesignItem[]
    >;
    for (const design of kanbanQuery.data ?? []) {
      const lane = resolveStageLaneKey(design);
      map[lane]?.push(design);
    }
    return map;
  }, [kanbanQuery.data]);

  const sections = useMemo((): PipelineAccordionSection<KanbanDesignItem>[] => {
    if (viewMode === "stage") {
      const laneIds = [...STAGE_LANE_CODES, "OTHER", "DONE"];
      return laneIds.map((code, index) => ({
        id: code,
        label: stageLaneLabel(code),
        sequence: index + 1,
        accent: stageLaneAccent(code),
        items: stageGrouped[code] ?? [],
      }));
    }
    return KANBAN_COLUMNS.map((status, index) => ({
      id: status,
      label: pipelineStatusLabel(status),
      sequence: index + 1,
      accent: pipelineStatusAccent(status),
      items: statusGrouped[status] ?? [],
    }));
  }, [viewMode, statusGrouped, stageGrouped]);

  function setMode(mode: KanbanViewMode) {
    setViewMode(mode);
    setDragId(null);
    setExpandedId(mode === "status" ? "ACTIVE" : "SKETCH");
  }

  function toggleSection(sectionId: string) {
    setExpandedId((prev) => (prev === sectionId ? null : sectionId));
  }

  function handleDrop(status: string) {
    if (viewMode !== "status" || !dragId) return;
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

  const isStageView = viewMode === "stage";

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Design Pipeline"
        subtitle={
          isStageView
            ? "Stage lanes by workflow sample step (read-only). Switch to Status to drag lifecycle columns."
            : "Status board - drag designs between lifecycle columns. Switch to Stage for sample workflow lanes."
        }
        actions={
          <div className="design-kanban-header-actions">
            <div className="design-kanban-view-toggle" role="group" aria-label="Pipeline view mode">
              <AppButton
                type="button"
                size="sm"
                appVariant={viewMode === "status" ? "primary" : "secondary"}
                onClick={() => setMode("status")}
              >
                Status
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                appVariant={viewMode === "stage" ? "primary" : "secondary"}
                onClick={() => setMode("stage")}
              >
                Stage
              </AppButton>
            </div>
            <AppButtonLink href={ROUTES.designs.list} appVariant="secondary" size="sm">
              Table view
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
        <PipelineAccordionBoard
          sections={sections}
          expandedId={expandedId}
          onToggle={toggleSection}
          onDragStart={isStageView ? undefined : setDragId}
          onDragEnd={isStageView ? undefined : () => setDragId(null)}
          onDrop={isStageView ? undefined : handleDrop}
          getItemId={(design) => design.id}
          renderCard={(design) => (
            <DesignPipelineCard design={design} showStatusHint={isStageView} />
          )}
          emptyLabel={isStageView ? "No designs in this stage" : "No designs in this phase"}
          previewLimit={15}
        />
      </QueryState>
    </div>
  );
}
