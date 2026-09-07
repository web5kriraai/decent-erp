import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Sub-process code → Skill.code used for eligible-employee filtering (spec §6.2). */
export const STAGE_TO_SKILL_CODE: Record<string, string> = {
  CONCEPT_REVIEW: "DESIGN_LEAD",
  SKETCH: "SKETCH",
  SKETCH_APPROVAL: "DESIGN_LEAD",
  PUNCH: "PUNCH",
  PUNCH_CHECK: "SAMPLE_CHECK",
  MAT_REQ: "DESIGN_LEAD",
  FABRIC_ISSUE: "PRODUCTION_LEAD",
  MACHINE_SAMPLE: "MACHINE_SAMPLE",
  SAMPLE_CUTTING: "MACHINE_SAMPLE",
  SAMPLE_STITCHING: "MACHINE_SAMPLE",
  SAMPLE_RECEIVE: "MACHINE_SAMPLE",
  SAMPLE_CHECK: "SAMPLE_CHECK",
  COSTING: "COSTING",
  FINAL_APPROVAL: "DESIGN_LEAD",
  PROD_HANDOFF: "DESIGN_LEAD",
  PROD_INSTRUCTION: "PRODUCTION_LEAD",
  PROD_RELEASE: "PRODUCTION_LEAD",
  LIVE_REVIEW: "MANAGEMENT",
};

const OPEN_WORKLOAD_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "CORRECTION_REQUIRED",
] as const;

export type ResolveAssigneeOptions = {
  /** Optional skill gate (spec §6.2 SkillId). When set, only employees with this skill are eligible. */
  skillId?: number | null;
  /** Prefer not to reuse these employees within the same generation batch (round-robin). */
  excludeEmployeeIds?: number[];
  /** Virtual open-task counts already assigned in this batch (employeeId → count). */
  workloadDelta?: Map<number, number>;
  tx?: Prisma.TransactionClient | typeof prisma;
};

/**
 * Resolve RoleId (+ optional SkillId) → eligible employee with least open workload.
 * Spec §6.2 - never hardcode names; prefer skill match then least open tasks, then lowest id.
 */
export async function resolveEmployeeForRole(
  roleId: number,
  options?: ResolveAssigneeOptions,
): Promise<number | null> {
  const db = options?.tx ?? prisma;
  const skillId = options?.skillId ?? null;
  const exclude = new Set(options?.excludeEmployeeIds ?? []);
  const delta = options?.workloadDelta;

  const candidates = await db.employee.findMany({
    where: {
      roleId,
      active: true,
      ...(skillId
        ? { skills: { some: { skillId, active: true } } }
        : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  // If skill filter yields nobody, fall back to role-only (pattern may set skill before skills are seeded).
  const pool =
    candidates.length > 0 || !skillId
      ? candidates
      : await db.employee.findMany({
          where: { roleId, active: true },
          select: { id: true },
          orderBy: { id: "asc" },
        });

  const eligible = pool.filter((e) => !exclude.has(e.id));
  if (eligible.length === 0) return null;

  const ids = eligible.map((e) => e.id);
  const openCounts = await db.designTask.groupBy({
    by: ["assignedEmployeeId"],
    where: {
      assignedEmployeeId: { in: ids },
      status: { in: [...OPEN_WORKLOAD_STATUSES] },
    },
    _count: { _all: true },
  });

  const countById = new Map<number, number>();
  for (const id of ids) countById.set(id, 0);
  for (const row of openCounts) {
    if (row.assignedEmployeeId == null) continue;
    countById.set(row.assignedEmployeeId, row._count._all);
  }
  if (delta) {
    for (const [id, extra] of delta) {
      if (countById.has(id)) {
        countById.set(id, (countById.get(id) ?? 0) + extra);
      }
    }
  }

  let bestId = ids[0]!;
  let bestLoad = countById.get(bestId) ?? 0;
  for (const id of ids) {
    const load = countById.get(id) ?? 0;
    if (load < bestLoad || (load === bestLoad && id < bestId)) {
      bestId = id;
      bestLoad = load;
    }
  }
  return bestId;
}

/**
 * Resolve assignees for a batch of pattern tasks, balancing load across the batch
 * so multiple steps with the same role do not all collapse onto one person.
 */
export async function resolveEmployeesForRoles(
  roleIds: number[],
): Promise<Map<number, number | null>> {
  const unique = [...new Set(roleIds)];
  const map = new Map<number, number | null>();
  const workloadDelta = new Map<number, number>();
  for (const roleId of unique) {
    const assignee = await resolveEmployeeForRole(roleId, { workloadDelta });
    map.set(roleId, assignee);
    if (assignee != null) {
      workloadDelta.set(assignee, (workloadDelta.get(assignee) ?? 0) + 1);
    }
  }
  return map;
}

export type PatternAssigneeInput = {
  defaultRoleId: number;
  defaultSkillId?: number | null;
};

/** Per-task resolution preserving skill + in-batch load balancing. */
export async function resolveAssigneesForPatternTasks(
  tasks: PatternAssigneeInput[],
  options?: { tx?: Prisma.TransactionClient | typeof prisma },
): Promise<Array<number | null>> {
  const workloadDelta = new Map<number, number>();
  const result: Array<number | null> = [];
  for (const task of tasks) {
    const assignee = await resolveEmployeeForRole(task.defaultRoleId, {
      skillId: task.defaultSkillId,
      workloadDelta,
      tx: options?.tx,
    });
    result.push(assignee);
    if (assignee != null) {
      workloadDelta.set(assignee, (workloadDelta.get(assignee) ?? 0) + 1);
    }
  }
  return result;
}

/**
 * Resolve SkillId for a design task: prefer persisted requiredSkillId, else pattern
 * defaultSkillId, else STAGE_TO_SKILL_CODE master lookup.
 */
export async function resolveSkillIdForTask(
  task: {
    requiredSkillId?: number | null;
    designId: bigint;
    subProcessId: number;
    subProcessCode?: string | null;
  },
  options?: { tx?: Prisma.TransactionClient | typeof prisma },
): Promise<number | null> {
  if (task.requiredSkillId != null) return task.requiredSkillId;
  const db = options?.tx ?? prisma;

  const design = await db.designConcept.findUnique({
    where: { id: task.designId },
    select: { workflowPatternId: true },
  });
  if (design?.workflowPatternId != null) {
    const patternTask = await db.workflowPatternTask.findFirst({
      where: {
        workflowPatternId: design.workflowPatternId,
        subProcessId: task.subProcessId,
      },
      select: { defaultSkillId: true },
    });
    if (patternTask?.defaultSkillId != null) return patternTask.defaultSkillId;
  }

  const code = task.subProcessCode;
  if (!code) return null;
  const skillCode = STAGE_TO_SKILL_CODE[code];
  if (!skillCode) return null;
  const skill = await db.skill.findFirst({
    where: { code: skillCode, active: true },
    select: { id: true },
  });
  return skill?.id ?? null;
}

/** Role + skill resolve for an existing design task (unlock / correction / handoff). */
export async function resolveAssigneeForDesignTask(
  task: {
    assignedRoleId: number;
    requiredSkillId?: number | null;
    designId: bigint;
    subProcessId: number;
    subProcessCode?: string | null;
  },
  options?: ResolveAssigneeOptions,
): Promise<number | null> {
  const skillId =
    options?.skillId !== undefined
      ? options.skillId
      : await resolveSkillIdForTask(task, { tx: options?.tx });
  return resolveEmployeeForRole(task.assignedRoleId, {
    ...options,
    skillId,
  });
}

/** Look up Skill.id for a stage code via STAGE_TO_SKILL_CODE. */
export async function resolveSkillIdForStageCode(
  tx: Prisma.TransactionClient | typeof prisma,
  stageCode: string,
): Promise<number | null> {
  const skillCode = STAGE_TO_SKILL_CODE[stageCode];
  if (!skillCode) return null;
  const skill = await tx.skill.findFirst({
    where: { code: skillCode, active: true },
    select: { id: true },
  });
  return skill?.id ?? null;
}
