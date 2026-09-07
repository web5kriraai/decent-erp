"use client";

import { cn } from "@/lib/utils";
import { hasHandoffFacts, type HandoffContext } from "@/lib/handoff-context";

type ActionHandoffBannerProps = {
  context?: HandoffContext | null;
  className?: string;
  /** Compact for tight panels */
  dense?: boolean;
};

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

  return (
    <aside
      className={cn(
        "action-handoff-banner rounded-md border border-border bg-muted/30",
        dense ? "space-y-1.5 px-3 py-2" : "space-y-2 px-3.5 py-3",
        className,
      )}
      aria-label="Handoff context"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {ctx.ideaRef ? (
          <p className="text-sm font-semibold tracking-tight text-foreground">{ctx.ideaRef}</p>
        ) : null}
        {ctx.stageName ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{ctx.stageName}</span>
            {ctx.stageCode ? (
              <span className="ml-1.5 font-mono text-[0.7rem] uppercase text-muted-foreground">
                {ctx.stageCode}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {metaBits.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{metaBits.join(" · ")}</p>
      ) : null}

      {ctx.description ? (
        <p className="text-xs leading-relaxed text-foreground/90">{ctx.description}</p>
      ) : null}

      {ctx.nextStepHint ? (
        <p className="rounded border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs font-medium text-foreground">
          Next: {ctx.nextStepHint}
        </p>
      ) : null}

      {ctx.priorStage ? (
        <div className="rounded border border-border/80 bg-background/80 px-2.5 py-2 text-xs">
          <p className="font-medium text-foreground">
            Prior: {ctx.priorStage.name}
            {ctx.priorStage.status ? (
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({ctx.priorStage.status})
              </span>
            ) : null}
          </p>
          {ctx.priorStage.assigneeName ? (
            <p className="mt-0.5 text-muted-foreground">By {ctx.priorStage.assigneeName}</p>
          ) : null}
          {ctx.priorStage.outputRemark ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-foreground/90">
              {ctx.priorStage.outputRemark}
            </p>
          ) : null}
          {ctx.priorStage.fileCount != null && ctx.priorStage.fileCount > 0 ? (
            <p className="mt-1 text-muted-foreground">
              {ctx.priorStage.fileCount} file{ctx.priorStage.fileCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ) : null}

      {(ctx.costingTotal != null ||
        ctx.costingEntryCount != null ||
        ctx.openCorrections != null ||
        ctx.fileCount != null ||
        ctx.sampleOutcome) && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {ctx.costingEntryCount != null ? (
            <li>
              Costs: {ctx.costingEntryCount}
              {ctx.costingTotal != null ? ` · ₹${ctx.costingTotal.toFixed(2)}` : ""}
            </li>
          ) : null}
          {ctx.openCorrections != null ? <li>Open corrections: {ctx.openCorrections}</li> : null}
          {ctx.fileCount != null ? <li>Files: {ctx.fileCount}</li> : null}
          {ctx.sampleOutcome ? <li>Sample: {ctx.sampleOutcome}</li> : null}
        </ul>
      )}

      {ctx.blockers && ctx.blockers.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-amber-900" role="status">
          {ctx.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
