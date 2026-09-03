import type { Prisma } from "@prisma/client";

type CorrectionAccessRow = {
  responsibleEmployeeId?: number | null;
  raisedById?: number | null;
  task?: { assignedEmployeeId?: number | null } | null;
};

/** Corrections the employee raised, is responsible for, or owns via the source task. */
export function correctionVisibleToEmployee(
  correction: CorrectionAccessRow,
  employeeId: number,
): boolean {
  if (correction.responsibleEmployeeId === employeeId) return true;
  if (correction.raisedById === employeeId) return true;
  if (correction.task?.assignedEmployeeId === employeeId) return true;
  return false;
}

/** Product lifecycle statuses shown in the Corrections UI / API writes. */
export const CORRECTION_WORKFLOW_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "REJECTED",
] as const;

export type CorrectionWorkflowStatus = (typeof CORRECTION_WORKFLOW_STATUSES)[number];

/**
 * Legacy DB values ASSIGNED/CHECKING were copied from TaskStatus.
 * Treat them as in-progress for queues and display.
 */
export function normalizeCorrectionStatus(status: string): CorrectionWorkflowStatus | string {
  if (status === "ASSIGNED" || status === "CHECKING") return "IN_PROGRESS";
  return status;
}

/** Still-open correction statuses (includes legacy aliases). */
export const OPEN_CORRECTION_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "CHECKING",
] as const;

export function isOpenCorrectionStatus(status: string): boolean {
  return (OPEN_CORRECTION_STATUSES as readonly string[]).includes(status);
}

/**
 * Status options for the corrections UI dropdown.
 * Unauthorized/terminal statuses are omitted — only valid next steps + current.
 */
export function getAllowedCorrectionStatusOptions(
  status: string,
): CorrectionWorkflowStatus[] {
  const normalized = normalizeCorrectionStatus(status);
  if (normalized === "DONE" || normalized === "REJECTED") {
    return [normalized as CorrectionWorkflowStatus];
  }
  if (normalized === "OPEN") {
    return ["OPEN", "IN_PROGRESS", "DONE", "REJECTED"];
  }
  if (normalized === "IN_PROGRESS") {
    return ["IN_PROGRESS", "DONE", "REJECTED"];
  }
  return [...CORRECTION_WORKFLOW_STATUSES];
}


/** Statuses that mean the routed rework task finished enough for re-check. */
export const ROUTED_REWORK_SATISFIED_STATUSES = [
  "COMPLETED",
  "CHECKING",
  "SKIPPED",
] as const;

export function isRoutedReworkSatisfied(status: string): boolean {
  return (ROUTED_REWORK_SATISFIED_STATUSES as readonly string[]).includes(status);
}

export function buildCorrectionScopeForEmployee(
  employeeId: number,
): Prisma.DesignCorrectionWhereInput {
  return {
    OR: [
      { responsibleEmployeeId: employeeId },
      { raisedById: employeeId },
      { task: { assignedEmployeeId: employeeId } },
    ],
  };
}
