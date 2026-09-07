/**
 * Transition Policy Registry - single source of truth for cross-stage data gates.
 *
 * Flow = which DesignTasks exist (pattern). Behavior = StageCapabilities.
 * This module evaluates whether present, active capability-bearing stages
 * require data (e.g. costing) before a named transition.
 *
 * Do not re-implement designRequiresCosting / costing gates in UI or services.
 */

import {
  APP_ERROR_CODES,
  APP_ERROR_MESSAGES,
} from "@/lib/errors/app-errors";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

export type TransitionId = "design.sign_off" | "design.production_release";

export type TransitionBlocker = {
  code: string;
  message: string;
};

export type TransitionMeta = {
  requiresCosting: boolean;
};

export type TransitionEvaluation = {
  ok: boolean;
  blockers: TransitionBlocker[];
  meta: TransitionMeta;
};

/** Stages in these statuses do not activate data gates (bypass / cancel). */
export const TRANSITION_INACTIVE_STATUSES = new Set(["SKIPPED", "CANCELLED"]);

export type PolicyTaskSnapshot = {
  status: string;
  subProcess: {
    code: string;
    name?: string;
    isApproval?: boolean;
    isFileRequired?: boolean;
    capabilities?: unknown;
  };
};

/**
 * True when the design has at least one active (non-SKIPPED/CANCELLED) stage
 * whose resolved behavior requires a costing entry (`costingEntry` capability).
 */
export function designRequiresCosting(tasks: PolicyTaskSnapshot[]): boolean {
  return tasks.some((task) => {
    if (TRANSITION_INACTIVE_STATUSES.has(task.status)) return false;
    const behavior = resolveStageBehavior({
      code: task.subProcess.code,
      name: task.subProcess.name,
      isApproval: task.subProcess.isApproval,
      isFileRequired: task.subProcess.isFileRequired,
      capabilities: task.subProcess.capabilities,
    });
    return behavior.costingEntry;
  });
}

/** Shared UI/queue helper: costing is "ready" unless the pattern requires it and data is missing. */
export function isCostingReadyForTransition(
  requiresCosting: boolean,
  hasCosting: boolean,
): boolean {
  return !requiresCosting || hasCosting;
}

export type EvaluateTransitionInput = {
  transition: TransitionId;
  tasks: PolicyTaskSnapshot[];
  /** True when designHasCosting (amount > 0) is satisfied. */
  hasCosting: boolean;
  /**
   * For design.sign_off: pass false when workflow stages are incomplete.
   * Omit / true when the caller already enforced stage readiness.
   */
  stagesComplete?: boolean;
};

/**
 * Evaluate presence-driven data policies for a transition.
 * Lifecycle status and present-stage gap checks for production_release remain
 * in validateProductionReleaseReadiness (DB-backed); costing uses this meta.
 */
export function evaluateTransition(
  input: EvaluateTransitionInput,
): TransitionEvaluation {
  const requiresCosting = designRequiresCosting(input.tasks);
  const blockers: TransitionBlocker[] = [];

  if (input.transition === "design.sign_off" && input.stagesComplete === false) {
    blockers.push({
      code: APP_ERROR_CODES.WORKFLOW_NOT_READY,
      message:
        "All required workflow stages must be complete before approving for production.",
    });
  }

  if (requiresCosting && !input.hasCosting) {
    blockers.push({
      code: APP_ERROR_CODES.COSTING_REQUIRED,
      message: APP_ERROR_MESSAGES.COSTING_REQUIRED,
    });
  }

  return {
    ok: blockers.length === 0,
    blockers,
    meta: { requiresCosting },
  };
}

/** First blocker matching code, if any. */
export function findTransitionBlocker(
  evaluation: TransitionEvaluation,
  code: string,
): TransitionBlocker | undefined {
  return evaluation.blockers.find((b) => b.code === code);
}
