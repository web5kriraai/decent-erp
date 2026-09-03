"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ApprovedDesignForProduction } from "@/hooks/use-production";
import {
  canOpenProductionDeskNextAction,
  classifyProductionDeskRow,
  PRODUCTION_DESK_LADDER_CODES,
  PRODUCTION_DESK_STAGE_LABELS,
  type ProductionDeskPipelineBucket,
} from "@/lib/services/production-desk-snapshot";
import { cn } from "@/lib/utils";

type PipelineFilter = "ALL" | ProductionDeskPipelineBucket;

const FILTERS: Array<{ key: PipelineFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "handoff", label: "Handoff" },
  { key: "instruction", label: "Instruction" },
  { key: "ready", label: "Ready" },
  { key: "blocked", label: "Blocked" },
  { key: "missing_ladder", label: "Missing stages" },
];

function stageBadgeStatus(status: string | null): string {
  if (!status) return "PENDING";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "RUNNING" || status === "CHECKING") return "CHECKING";
  if (status === "ON_HOLD" || status === "CORRECTION_REQUIRED") return "REJECTED";
  if (status === "ASSIGNED" || status === "PENDING") return "PENDING";
  return status;
}

function waitingCopy(row: ApprovedDesignForProduction): string | null {
  const stages = row.ladderStages ?? [];
  if (!row.nextAction) {
    if (stages.every((s) => !s.taskId)) {
      return "Production stages not created yet";
    }
    if (!row.releaseReady && row.releaseMissing?.length) {
      return `Waiting: ${row.releaseMissing.slice(0, 2).join("; ")}`;
    }
    return null;
  }
  const label = row.nextAction.label;
  if (row.nextAction.assigneeName) {
    return `Waiting on ${label} · ${row.nextAction.assigneeName}`;
  }
  return `Waiting on ${label}`;
}

function PipelineRow({
  row,
  roleCode,
  permissions,
  employeeId,
}: {
  row: ApprovedDesignForProduction;
  roleCode?: string | null;
  permissions: string[];
  employeeId?: number | null;
}) {
  const stages = row.ladderStages ?? [];
  const canOpen = canOpenProductionDeskNextAction({
    roleCode,
    permissions,
    employeeId,
    nextAction: row.nextAction,
  });
  const waiting = waitingCopy(row);

  return (
    <article className="production-desk-row">
      <div className="production-desk-row-main">
        <div className="production-desk-row-title-block">
          <Link href={ROUTES.designs.detail(row.id)} className="production-desk-row-ref">
            {row.ideaRef}
          </Link>
          <p className="production-desk-row-meta">
            {row.collectionName}
            <span aria-hidden> · </span>
            {row.productType.name}
            <span aria-hidden> · </span>
            {row.designHead.name}
          </p>
        </div>

        <ol className="production-desk-ladder" aria-label="Production ladder">
          {PRODUCTION_DESK_LADDER_CODES.map((code) => {
            const stage = stages.find((s) => s.code === code);
            const status = stage?.status ?? null;
            const done = status === "COMPLETED";
            const active = row.nextAction?.code === code;
            return (
              <li
                key={code}
                className={cn(
                  "production-desk-ladder-step",
                  done && "production-desk-ladder-step--done",
                  active && "production-desk-ladder-step--active",
                  !status && "production-desk-ladder-step--missing",
                )}
              >
                <span className="production-desk-ladder-label">
                  {PRODUCTION_DESK_STAGE_LABELS[code]}
                </span>
                <StatusBadge
                  status={stageBadgeStatus(status)}
                  label={status ? status.replace(/_/g, " ") : "—"}
                />
              </li>
            );
          })}
        </ol>

        <div className="production-desk-row-gate">
          {row.releaseReady ? (
            <StatusBadge status="COMPLETED" label="Release gate ready" />
          ) : (
            <div>
              <StatusBadge status="CHECKING" label="Release gate blocked" />
              {row.releaseMissing?.length ? (
                <p className="production-desk-row-gate-detail">
                  {row.releaseMissing.slice(0, 2).join("; ")}
                  {row.releaseMissing.length > 2
                    ? ` (+${row.releaseMissing.length - 2})`
                    : ""}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="production-desk-row-actions">
        {canOpen && row.nextAction ? (
          <AppButtonLink
            href={ROUTES.work.taskDetail(row.nextAction.taskId)}
            appVariant="primary"
            size="sm"
          >
            {`Open ${row.nextAction.label}`}
          </AppButtonLink>
        ) : waiting ? (
          <p className="production-desk-waiting">{waiting}</p>
        ) : null}
      </div>
    </article>
  );
}

export function ProductionPipelineBoard({
  designs,
  roleCode,
  permissions,
  employeeId,
}: {
  designs: ApprovedDesignForProduction[];
  roleCode?: string | null;
  permissions: string[];
  employeeId?: number | null;
}) {
  const [filter, setFilter] = useState<PipelineFilter>("ALL");

  const rowsWithBucket = useMemo(
    () =>
      designs.map((row) => ({
        row,
        bucket: classifyProductionDeskRow({
          releaseReady: row.releaseReady,
          nextAction: row.nextAction,
          stages: row.ladderStages ?? [],
        }),
      })),
    [designs],
  );

  const counts = useMemo(() => {
    const base: Record<PipelineFilter, number> = {
      ALL: rowsWithBucket.length,
      blocked: 0,
      handoff: 0,
      instruction: 0,
      ready: 0,
      missing_ladder: 0,
    };
    for (const item of rowsWithBucket) {
      base[item.bucket] += 1;
    }
    return base;
  }, [rowsWithBucket]);

  const filtered = useMemo(() => {
    const list =
      filter === "ALL"
        ? rowsWithBucket
        : rowsWithBucket.filter((item) => item.bucket === filter);
    const rank = (b: ProductionDeskPipelineBucket) => {
      if (b === "ready") return 0;
      if (b === "instruction") return 1;
      if (b === "handoff") return 2;
      if (b === "blocked") return 3;
      return 4;
    };
    return [...list].sort((a, b) => {
      const byBucket = rank(a.bucket) - rank(b.bucket);
      if (byBucket !== 0) return byBucket;
      return a.row.ideaRef.localeCompare(b.row.ideaRef);
    });
  }, [rowsWithBucket, filter]);

  return (
    <AppCard
      title="Production pipeline"
      className="stack-section"
      description="Active designs first. Open a step only when it is assigned to you."
    >
      <div className="production-desk-board">
        <div className="production-desk-filters" role="tablist" aria-label="Filter pipeline">
          {FILTERS.map((item) => {
            if (item.key !== "ALL" && counts[item.key] === 0) return null;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                className={cn(
                  "production-desk-filter",
                  filter === item.key && "production-desk-filter--active",
                )}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                <span className="production-desk-filter-count">{counts[item.key]}</span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="production-desk-empty">
            <p className="production-desk-empty-title">Nothing in the production queue yet</p>
            <p className="production-desk-empty-text">
              Designs appear here after management approval. Complete handoff → instruction →
              release on My Tasks.
            </p>
          </div>
        ) : (
          <div className="production-desk-rows">
            {filtered.map(({ row }) => (
              <PipelineRow
                key={row.id}
                row={row}
                roleCode={roleCode}
                permissions={permissions}
                employeeId={employeeId}
              />
            ))}
          </div>
        )}
      </div>
    </AppCard>
  );
}
