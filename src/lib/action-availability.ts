import {
  findDependencyBlocker,
  type DepSibling,
  type MyTaskRow,
} from "@/lib/services/action-center";
import { isTaskReady } from "@/lib/services/task-dependency";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";

export type ActionAvailability = {
  available: boolean;
  reason?: string;
};

export function canRoleMarkDesignLive(roleCode: string | null | undefined): boolean {
  return roleCode === ROLE_CODES.MANAGEMENT || roleCode === ROLE_CODES.ADMIN;
}

/**
 * Recovery tool on Production Desk: append/unlock PROD_* ladder for stuck approved designs.
 * Requires PRODUCTION_RELEASE plus Management/Admin role or WORKFLOW_OVERRIDE.
 */
export function canEnsureProductionLadder(
  roleCode: string | null | undefined,
  permissions: string[],
): boolean {
  if (!permissions.includes(PERMISSIONS.PRODUCTION_RELEASE)) return false;
  if (roleCode === ROLE_CODES.MANAGEMENT || roleCode === ROLE_CODES.ADMIN) return true;
  return permissions.includes(PERMISSIONS.WORKFLOW_OVERRIDE);
}

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

  if (task.status === "PENDING") {
    const ready = isTaskReady(
      {
        id: task.id,
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (!ready) {
      const blocker = findDependencyBlocker(task, siblings);
      return {
        available: false,
        reason: blocker
          ? describeDependencyBlocker(blocker)
          : "Earlier workflow stages must finish before you can start this task.",
      };
    }
  } else if (task.status !== "ASSIGNED" && task.status !== "CORRECTION_REQUIRED") {
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

export function getMarkLiveAvailability(
  designStatus: string,
  options?: { liveReviewCompleted?: boolean; roleCode?: string | null },
): ActionAvailability {
  if (options?.roleCode != null && !canRoleMarkDesignLive(options.roleCode)) {
    return {
      available: false,
      reason: "Only Management can mark a design live.",
    };
  }
  if (designStatus !== "PRODUCTION_RELEASED") {
    return {
      available: false,
      reason: "Only production-released designs can be marked live.",
    };
  }
  // Require explicit completion — omit/undefined must not unlock Mark Live.
  if (options?.liveReviewCompleted !== true) {
    return {
      available: false,
      reason: "Management live design review must be completed before marking live.",
    };
  }
  return { available: true };
}
