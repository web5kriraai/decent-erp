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

export const OPEN_CORRECTION_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "CHECKING",
] as const;

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
