import type { Priority } from "@prisma/client";

export const TASK_DATE_MODES = ["SEQUENTIAL", "SAME_DAY"] as const;
export type TaskDateMode = (typeof TASK_DATE_MODES)[number];

export function isTaskDateMode(value: string): value is TaskDateMode {
  return (TASK_DATE_MODES as readonly string[]).includes(value);
}

/**
 * Resolve calendar day offset for a pattern step.
 * - SEQUENTIAL: use pattern dayOffset (default)
 * - SAME_DAY: all stages share the create day
 */
export function effectiveDayOffset(
  mode: TaskDateMode,
  patternDayOffset: number,
  _index: number,
): number {
  switch (mode) {
    case "SAME_DAY":
      return 0;
    case "SEQUENTIAL":
    default:
      return patternDayOffset;
  }
}

export function addUtcDays(base: Date, dayOffset: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + dayOffset);
  return result;
}

export function plannedDueAt(
  plannedStart: Date,
  expectedMinutes: number,
): Date {
  return new Date(plannedStart.getTime() + expectedMinutes * 60_000);
}

export function formatPlannedDateLabel(base: Date, dayOffset: number): string {
  return addUtcDays(base, dayOffset).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

export function resolveManualDueAt(
  dueAt: string | Date | undefined,
  base: Date,
  expectedMinutes: number,
): Date {
  if (dueAt instanceof Date && !Number.isNaN(dueAt.getTime())) {
    return dueAt;
  }
  if (typeof dueAt === "string" && dueAt.trim()) {
    const parsed = new Date(dueAt.includes("T") ? dueAt : `${dueAt}T23:59:59`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return plannedDueAt(base, expectedMinutes);
}

export function hoursToExpectedMinutes(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 60);
}

export function expectedMinutesToHoursLabel(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export type WorkflowPreviewRow = {
  sequence: number;
  processId: number;
  subProcessId: number;
  stage: string;
  assigneeName: string;
  assignedEmployeeId: number | null;
  roleName: string | null;
  hours: string;
  expectedMinutes: number;
  plannedDate: string;
  plannedStart: string;
  dueAt: string;
  priority: Priority;
};
