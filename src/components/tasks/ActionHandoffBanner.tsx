"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { sanitizeHandoffRemark } from "@/lib/services/costing-end-utils";
import { cn } from "@/lib/utils";
import { hasHandoffFacts, type HandoffContext } from "@/lib/handoff-context";

type ActionHandoffBannerProps = {
  context?: HandoffContext | null;
  className?: string;
  /** Compact for tight panels */
  dense?: boolean;
};

function HandoffTile({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("handoff-tile", className)}>
      <span className="handoff-tile-label">{label}</span>
      <div className="handoff-tile-value">{children}</div>
    </div>
  );
}

export function ActionHandoffBanner({
  context,
  className,
  dense = false,
}: ActionHandoffBannerProps) {
  if (!hasHandoffFacts(context)) return null;
  const ctx = context!;

  const metaBits = [
    ctx.productType,
    ctx.collectionName,
    ctx.priority ? `Priority ${ctx.priority}` : null,
    ctx.assigneeName ? `Assignee ${ctx.assigneeName}` : null,
    ctx.status,
  ].filter(Boolean);

  const showMetrics =
    ctx.costingTotal != null ||
    ctx.costingEntryCount != null ||
    ctx.openCorrections != null ||
    ctx.fileCount != null ||
    Boolean(ctx.sampleOutcome);

  const priorRemark = sanitizeHandoffRemark(ctx.priorStage?.outputRemark);
  const hasPrior = Boolean(ctx.priorStage);
  const nextHint = ctx.nextStepHint?.trim() || null;
  // Dense approval panels: Next + Prior as compact fact rows (not empty half-tiles).
  const useDenseFacts = Boolean(dense && (nextHint || hasPrior));
  const showNextTile = Boolean(nextHint && !useDenseFacts);
  const showPriorTile = Boolean(hasPrior && !useDenseFacts);
  const showGrid = Boolean(showNextTile || showPriorTile || showMetrics);

  return (
    <aside
      className={cn(
        "action-handoff-banner",
        dense ? "action-handoff-banner--dense" : null,
        className,
      )}
      aria-label="Handoff context"
    >
      <div className="handoff-header">
        <div className="handoff-title-row">
          {ctx.ideaRef ? <p className="handoff-idea">{ctx.ideaRef}</p> : null}
          {ctx.stageName ? <p className="handoff-stage">{ctx.stageName}</p> : null}
        </div>
        {metaBits.length > 0 ? (
          <p className="handoff-meta">{metaBits.join(" · ")}</p>
        ) : null}
        {ctx.description ? <p className="handoff-description">{ctx.description}</p> : null}
      </div>

      {useDenseFacts ? (
        <div className="handoff-facts">
          {nextHint ? (
            <div className="handoff-fact handoff-fact--next">
              <span className="handoff-fact-label">Next</span>
              <p className="handoff-fact-text">{nextHint}</p>
            </div>
          ) : null}
          {ctx.priorStage ? (
            <div className="handoff-fact">
              <span className="handoff-fact-label">Prior</span>
              <div className="handoff-fact-body">
                <div className="handoff-prior-head">
                  <span className="handoff-prior-name">{ctx.priorStage.name}</span>
                  {ctx.priorStage.status ? (
                    <StatusBadge status={ctx.priorStage.status} />
                  ) : null}
                </div>
                {ctx.priorStage.assigneeName ? (
                  <p className="handoff-prior-meta">By {ctx.priorStage.assigneeName}</p>
                ) : null}
                {priorRemark ? (
                  <p className="handoff-prior-remark">{priorRemark}</p>
                ) : null}
                {ctx.priorStage.fileCount != null && ctx.priorStage.fileCount > 0 ? (
                  <p className="handoff-prior-meta">
                    {ctx.priorStage.fileCount} file
                    {ctx.priorStage.fileCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showGrid ? (
        <div className="handoff-grid">
          {showNextTile ? (
            <HandoffTile label="Next" className="handoff-tile--accent">
              <p className="handoff-tile-text">{nextHint}</p>
            </HandoffTile>
          ) : null}

          {showPriorTile && ctx.priorStage ? (
            <HandoffTile
              label="Prior"
              className={priorRemark ? "handoff-tile--wide" : undefined}
            >
              <div className="handoff-prior">
                <div className="handoff-prior-head">
                  <span className="handoff-prior-name">{ctx.priorStage.name}</span>
                  {ctx.priorStage.status ? (
                    <StatusBadge status={ctx.priorStage.status} />
                  ) : null}
                </div>
                {ctx.priorStage.assigneeName ? (
                  <p className="handoff-prior-meta">By {ctx.priorStage.assigneeName}</p>
                ) : null}
                {priorRemark ? (
                  <p className="handoff-prior-remark">{priorRemark}</p>
                ) : null}
                {ctx.priorStage.fileCount != null && ctx.priorStage.fileCount > 0 ? (
                  <p className="handoff-prior-meta">
                    {ctx.priorStage.fileCount} file
                    {ctx.priorStage.fileCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </HandoffTile>
          ) : null}

          {ctx.costingEntryCount != null || ctx.costingTotal != null ? (
            <HandoffTile label="Costs">
              <p className="handoff-metric-value">
                {ctx.costingTotal != null
                  ? `₹${ctx.costingTotal.toFixed(2)}`
                  : "-"}
              </p>
              {ctx.costingEntryCount != null ? (
                <p className="handoff-metric-sub">
                  {ctx.costingEntryCount} entr
                  {ctx.costingEntryCount === 1 ? "y" : "ies"}
                </p>
              ) : null}
            </HandoffTile>
          ) : null}

          {ctx.sampleOutcome ? (
            <HandoffTile label="Sample">
              <p className="handoff-tile-text">{ctx.sampleOutcome}</p>
            </HandoffTile>
          ) : null}

          {ctx.openCorrections != null ? (
            <HandoffTile label="Open corrections">
              <p className="handoff-metric-value">{ctx.openCorrections}</p>
            </HandoffTile>
          ) : null}

          {ctx.fileCount != null ? (
            <HandoffTile label="Files">
              <p className="handoff-metric-value">{ctx.fileCount}</p>
            </HandoffTile>
          ) : null}
        </div>
      ) : null}

      {ctx.blockers && ctx.blockers.length > 0 ? (
        <ul className="handoff-blockers" role="status">
          {ctx.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
