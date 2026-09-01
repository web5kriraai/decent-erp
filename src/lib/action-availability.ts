import {
  findDependencyBlocker,
  type DepSibling,
  type MyTaskRow,
} from "@/lib/services/action-center";

export type ActionAvailability = {
  available: boolean;
  reason?: string;
};

export function describeDependencyBlocker(blocker: DepSibling): string {
  const label = blocker.subProcess?.name ?? blocker.subProcess?.code ?? "Prior stage";
  const owner = blocker.assignedEmployee?.name;
  if (blocker.status === "CORRECTION_REQUIRED") {
    return `${label} needs a correction before you can continue${owner ? ` (${owner})` : ""}.`;
  }
  if (blocker.status === "CHECKING") {
    return `Waiting for ${label} to be checked${owner ? ` (${owner})` : ""}.`;
  }
  return `${label} must be completed first${owner ? ` (${owner})` : ""}.`;
}

export function getTaskStartAvailability(
  task: MyTaskRow,
  siblings: DepSibling[],
  options?: { hasRunningTask?: boolean },
): ActionAvailability {
  if (task.status === "ON_HOLD") {
    return {
      available: false,
      reason: "This task is on hold. Resume it instead of starting again.",
    };
  }

  if (task.status !== "ASSIGNED") {
    return {
      available: false,
      reason: "Only assigned tasks can be started.",
    };
  }

  if (options?.hasRunningTask) {
    return {
      available: false,
      reason: "End or hold your running task before starting another.",
    };
  }

  const blocker = findDependencyBlocker(task, siblings);
  if (blocker) {
    return { available: false, reason: describeDependencyBlocker(blocker) };
  }

  return { available: true };
}

export function getMarkLiveAvailability(designStatus: string): ActionAvailability {
  if (designStatus === "PRODUCTION_RELEASED") {
    return { available: true };
  }
  return {
    available: false,
    reason: "Only production-released designs can be marked live.",
  };
}
