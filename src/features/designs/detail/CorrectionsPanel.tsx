"use client";

import { AppButton } from "@/components/ui/AppButton";
import { RaiseCorrectionModal } from "@/features/quality/RaiseCorrectionModal";
import { formatActiveDuration } from "@/lib/services/correction-time-utils";
import type { DesignCorrectionDetail, DesignSummary } from "@/lib/types/api";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CorrectionsPanel({
  design,
  corrections,
  canRaise,
  raiseOpen,
  onRaiseOpenChange,
  defaultTaskId,
}: {
  design: DesignSummary;
  corrections: DesignCorrectionDetail[];
  canRaise?: boolean;
  raiseOpen?: boolean;
  onRaiseOpenChange?: (open: boolean) => void;
  defaultTaskId?: string;
}) {
  const showForm = !!raiseOpen;

  return (
    <div className="space-y-4">
      {canRaise && onRaiseOpenChange && !showForm ? (
        <AppButton
          type="button"
          appVariant="primary"
          size="sm"
          onClick={() => onRaiseOpenChange(true)}
        >
          Add Correction
        </AppButton>
      ) : null}

      {canRaise && onRaiseOpenChange && showForm ? (
        <RaiseCorrectionModal
          open
          presentation="inline"
          onClose={() => onRaiseOpenChange(false)}
          defaultDesignId={design.id}
          defaultIdeaRef={design.ideaRef}
          defaultCollectionName={design.collectionName}
          defaultTaskId={defaultTaskId}
        />
      ) : null}

      {corrections.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">No corrections recorded for this design.</p>
      ) : null}

      {corrections.length > 0 ? (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {corrections.map((c) => {
            const impact = Number(c.ratingImpact ?? 0);
            const penalty =
              impact < 0
                ? `Penalty ${impact}`
                : c.correctionType === "IMPROVEMENT"
                  ? "No penalty"
                  : null;
            const title =
              c.rootCause?.trim() ||
              `${c.correctionType.replaceAll("_", " ")} · ${c.status}`;
            const tb = c.timeBreakdown;
            return (
              <li key={c.id} className="relative">
                <span className="absolute -left-[1.4rem] top-3 size-2.5 rounded-full bg-primary" />
                <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(c.createdAtUtc)}
                    {c.raisedBy ? ` · Raised by ${c.raisedBy.name}` : ""}
                    {c.routeToSubProcess ? ` · Route ${c.routeToSubProcess.name}` : ""}
                    {c.reworkAssignee
                      ? ` · Rework ${c.reworkAssignee.name}`
                      : c.responsibleEmployee
                        ? ` · ${c.responsibleEmployee.name}`
                        : ""}
                    {penalty ? ` · ${penalty}` : ""}
                  </p>
                  {tb ? (
                    <p className="mt-1 text-xs font-medium text-foreground">
                      Prior {formatActiveDuration(tb.originalActiveSeconds)}
                      {" · "}
                      Rework {formatActiveDuration(tb.reworkActiveSeconds)}
                      {" · "}
                      Total {formatActiveDuration(tb.totalActiveSeconds)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
