/** Shared handoff contract for workflow action surfaces (end/hold/approve/sign-off/…). */

export type HandoffPriorStage = {
  code?: string;
  name: string;
  status?: string | null;
  outputRemark?: string | null;
  assigneeName?: string | null;
  fileCount?: number | null;
};

export type HandoffContext = {
  ideaRef?: string | null;
  collectionName?: string | null;
  productType?: string | null;
  priority?: string | null;
  stageCode?: string | null;
  stageName?: string | null;
  assigneeName?: string | null;
  status?: string | null;
  /** Server time already recorded on this task, or on the work being reviewed. */
  activeSeconds?: number | null;
  holdSeconds?: number | null;
  expectedMinutes?: number | null;
  /** Label for the time row. Defaults to "This task". */
  timeSectionTitle?: string | null;
  /** Who / which stage receives this action next */
  nextStepHint?: string | null;
  nextStage?: HandoffPriorStage | null;
  /** Short guidance (often from dialog config description) */
  description?: string | null;
  priorStage?: HandoffPriorStage | null;
  blockers?: string[];
  openCorrections?: number | null;
  fileCount?: number | null;
  costingTotal?: number | null;
  costingEntryCount?: number | null;
  sampleOutcome?: string | null;
};

export function hasHandoffFacts(ctx?: HandoffContext | null): boolean {
  if (!ctx) return false;
  return Boolean(
    ctx.ideaRef ||
      ctx.stageName ||
      ctx.nextStepHint ||
      ctx.description ||
      ctx.priorStage ||
      ctx.nextStage ||
      (ctx.blockers && ctx.blockers.length > 0) ||
      ctx.assigneeName ||
      ctx.collectionName ||
      ctx.productType,
  );
}
