"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { IconProduction } from "@/components/icons";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ListSearch } from "@/components/ui/ListSearch";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import type { ApprovedDesignForProduction } from "@/hooks/use-production";
import { useAcceptProductionHandoff } from "@/hooks/use-production";
import { PERMISSIONS } from "@/lib/permissions";
import type { ProductionInboxDesign } from "@/lib/services/production-inbox-service";
import { AcceptHandoffConfirm } from "@/features/production/AcceptHandoffConfirm";
import { ProductionReturnModal } from "@/features/production/ProductionReturnModal";
import { useClientList } from "@/hooks/use-client-list";
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

function shortStatus(status: string | null): string {
  if (!status) return "-";
  if (status === "COMPLETED") return "Done";
  if (status === "ASSIGNED") return "Assigned";
  if (status === "PENDING") return "Queued";
  if (status === "RUNNING") return "Running";
  if (status === "CHECKING") return "Checking";
  if (status === "ON_HOLD") return "Hold";
  if (status === "CORRECTION_REQUIRED") return "Correction";
  return status.replace(/_/g, " ");
}

function waitingCopy(row: ApprovedDesignForProduction): string | null {
  const stages = row.ladderStages ?? [];
  if (!row.nextAction) {
    if (stages.every((s) => !s.taskId)) {
      return "Stages not created yet";
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
  bucket,
  roleCode,
  permissions,
  employeeId,
  retryPending,
  onRetryRelease,
  onAccept,
  onReturn,
}: {
  row: ApprovedDesignForProduction;
  bucket: ProductionDeskPipelineBucket;
  roleCode?: string | null;
  permissions: string[];
  employeeId?: number | null;
  retryPending: boolean;
  onRetryRelease: (designId: string) => void;
  onAccept: (row: ApprovedDesignForProduction) => void;
  onReturn: (row: ApprovedDesignForProduction) => void;
}) {
  const stages = row.ladderStages ?? [];
  const handoff = stages.find((stage) => stage.code === "PROD_HANDOFF");
  const instruction = stages.find((stage) => stage.code === "PROD_INSTRUCTION");
  const release = stages.find((stage) => stage.code === "PROD_RELEASE");
  const canOperateRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const canAccept =
    canOperateRelease &&
    handoff?.status === "COMPLETED" &&
    instruction?.status === "PENDING";
  const canReturn =
    canOperateRelease &&
    handoff?.status === "COMPLETED" &&
    release?.status !== "COMPLETED" &&
    instruction?.status !== "COMPLETED";
  const canOpen = canOpenProductionDeskNextAction({
    roleCode,
    permissions,
    employeeId,
    nextAction: row.nextAction,
  });
  const waiting = waitingCopy(row);
  const showOpen = canOpen && !!row.nextAction && !canAccept && !row.releasePendingRetry;

  return (
    <article
      className={cn(
        "production-desk-row",
        `production-desk-row--${bucket === "missing_ladder" ? "missing" : bucket}`,
      )}
    >
      <div className="production-desk-row-title-block">
        <Link href={ROUTES.designs.detail(row.id)} className="production-desk-row-ref" title={row.collectionName}>
          {row.collectionName}
        </Link>
        <p className="production-desk-row-meta" title={`${row.ideaRef} · ${row.productType.name} · ${row.designHead.name}`}>
          {row.ideaRef}
          <span aria-hidden> · </span>
          {row.productType.name}
          <span aria-hidden> · </span>
          {row.designHead.name}
        </p>
      </div>

      <ol className="production-desk-ladder" aria-label="Production ladder">
        {PRODUCTION_DESK_LADDER_CODES.map((code, index) => {
          const stage = stages.find((s) => s.code === code);
          const status = stage?.status ?? null;
          const done = status === "COMPLETED";
          const active = row.nextAction?.code === code;
          return (
            <li key={code} className="production-desk-ladder-item">
              {index > 0 ? (
                <span
                  className={cn(
                    "production-desk-ladder-connector",
                    done || active ? "production-desk-ladder-connector--lit" : null,
                  )}
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  "production-desk-ladder-step",
                  done && "production-desk-ladder-step--done",
                  active && "production-desk-ladder-step--active",
                  !status && "production-desk-ladder-step--missing",
                )}
              >
                <span className="production-desk-ladder-index" aria-hidden>
                  {index + 1}
                </span>
                <span className="production-desk-ladder-label">
                  {PRODUCTION_DESK_STAGE_LABELS[code]}
                </span>
                <span className="production-desk-ladder-status">{shortStatus(status)}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="production-desk-row-footer">
        <div
          className="production-desk-row-gate"
          title={
            row.releaseMissing?.length
              ? row.releaseMissing.join("; ")
              : undefined
          }
        >
          {row.releaseReady ? (
            <StatusBadge status="COMPLETED" label="Gate ready" />
          ) : (
            <StatusBadge status="CHECKING" label="Gate blocked" />
          )}
          {!row.releaseReady && row.releaseMissing?.length ? (
            <span className="production-desk-row-gate-detail">
              {row.releaseMissing.slice(0, 2).join("; ")}
              {row.releaseMissing.length > 2
                ? ` (+${row.releaseMissing.length - 2})`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="production-desk-row-actions">
          {row.releasePendingRetry && canOperateRelease ? (
            <AppButton
              type="button"
              size="sm"
              disabled={retryPending}
              onClick={() => onRetryRelease(row.id)}
            >
              {retryPending ? "Releasing…" : "Retry release"}
            </AppButton>
          ) : null}
          {canAccept ? (
            <AppButton type="button" size="sm" onClick={() => onAccept(row)}>
              Accept
            </AppButton>
          ) : null}
          {canReturn ? (
            <AppButton type="button" appVariant="outline" size="sm" onClick={() => onReturn(row)}>
              Return
            </AppButton>
          ) : null}
          {showOpen && row.nextAction ? (
            <AppButtonLink
              href={ROUTES.work.taskDetail(row.nextAction.taskId)}
              appVariant="primary"
              size="sm"
            >
              {`Open ${row.nextAction.label}`}
            </AppButtonLink>
          ) : !canAccept && !row.releasePendingRetry && waiting ? (
            <p className="production-desk-waiting">{waiting}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type PipelineRowItem = {
  row: ApprovedDesignForProduction;
  bucket: ProductionDeskPipelineBucket;
};

function pipelineSearchText(item: PipelineRowItem) {
  const { row } = item;
  return `${row.ideaRef} ${row.collectionName} ${row.productType.name} ${row.designHead.name}`;
}

function acceptItemFromRow(row: ApprovedDesignForProduction): ProductionInboxDesign {
  return {
    designId: row.id,
    ideaRef: row.ideaRef,
    collectionName: row.collectionName,
    status: row.status,
    productType: row.productType.name,
    designHead: row.designHead.name,
    section: "ready_for_acceptance",
    stageLabel: "Accept production handoff",
    needsAcceptance: true,
  };
}

export function ProductionPipelineBoard({
  designs,
  roleCode,
  permissions,
  employeeId,
  retryPending = false,
  onRetryRelease,
}: {
  designs: ApprovedDesignForProduction[];
  roleCode?: string | null;
  permissions: string[];
  employeeId?: number | null;
  retryPending?: boolean;
  onRetryRelease?: (designId: string) => void;
}) {
  const [filter, setFilter] = useState<PipelineFilter>("ALL");
  const [acceptRow, setAcceptRow] = useState<ApprovedDesignForProduction | null>(null);
  const [returnRow, setReturnRow] = useState<ApprovedDesignForProduction | null>(null);
  const acceptHandoff = useAcceptProductionHandoff();

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

  const getSearchText = useCallback(pipelineSearchText, []);
  const list = useClientList({
    items: filtered,
    getSearchText,
    filterKey: filter,
  });

  return (
    <div className="production-desk-pipeline-card">
      <div className="production-desk-board">
        {designs.length > 0 ? (
          <>
          <div className="page-toolbar !mb-0 border-b px-3 py-2">
            <ListSearch
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search pipeline…"
              aria-label="Search production pipeline"
            />
          </div>
          <div className="production-desk-filters" role="group" aria-label="Filter pipeline">
            {FILTERS.map((item) => {
              if (item.key !== "ALL" && counts[item.key] === 0) return null;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={filter === item.key}
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
          </>
        ) : null}

        {list.filtered.length === 0 ? (
          <div className="production-desk-empty" role="status">
            <span className="production-desk-empty-icon" aria-hidden>
              <IconProduction className="size-6" />
            </span>
            <p className="production-desk-empty-title">
              {designs.length === 0
                ? "Queue is clear"
                : "No designs in this filter"}
            </p>
            <p className="production-desk-empty-text">
              {designs.length === 0
                ? "Approved designs land here for handoff, instruction, and release on My Tasks."
                : "Try another filter, or wait for the next stage to unlock."}
            </p>
          </div>
        ) : (
          <>
            <div className="production-desk-rows">
              {list.pageItems.map(({ row, bucket }) => (
                <PipelineRow
                  key={row.id}
                  row={row}
                  bucket={bucket}
                  roleCode={roleCode}
                  permissions={permissions}
                  employeeId={employeeId}
                  retryPending={retryPending}
                  onRetryRelease={(designId) => onRetryRelease?.(designId)}
                  onAccept={setAcceptRow}
                  onReturn={setReturnRow}
                />
              ))}
            </div>
            {list.total > 0 ? (
              <PaginationBar
                total={list.total}
                page={list.page}
                pageSize={list.pageSize}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                pageSizeSelectId="production-pipeline-page-size"
              />
            ) : null}
          </>
        )}
      </div>
      {returnRow ? (
        <ProductionReturnModal
          open
          designId={returnRow.id}
          ideaRef={returnRow.ideaRef}
          onClose={() => setReturnRow(null)}
        />
      ) : null}
      <AcceptHandoffConfirm
        open={!!acceptRow}
        item={acceptRow ? acceptItemFromRow(acceptRow) : null}
        onClose={() => setAcceptRow(null)}
        onConfirm={() => {
          if (!acceptRow) return;
          acceptHandoff.mutate(acceptRow.id, {
            onSuccess: () => setAcceptRow(null),
          });
        }}
        isPending={acceptHandoff.isPending}
      />
    </div>
  );
}
