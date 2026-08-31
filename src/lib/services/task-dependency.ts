import type { TaskStatus } from "@prisma/client";

/** Prior-stage statuses that unlock the next dependency sequence. */
export const DEPENDENCY_SATISFIED_STATUSES: readonly TaskStatus[] = [
  "COMPLETED",
  "CHECKING",
  "CANCELLED",
];

export function isDependencySatisfiedStatus(status: string): boolean {
  return (DEPENDENCY_SATISFIED_STATUSES as readonly string[]).includes(status);
}

export function effectiveDependencySequence(task: {
  dependencySequence: number | null;
  sequence: number;
}): number {
  return task.dependencySequence ?? task.sequence;
}
