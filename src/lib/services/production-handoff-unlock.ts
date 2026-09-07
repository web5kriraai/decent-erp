import type { Prisma } from "@prisma/client";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { createAppError, notFound, businessRule } from "@/lib/errors/create-app-error";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { resolveAssigneeForDesignTask, resolveEmployeeForRole, resolveSkillIdForStageCode } from "@/lib/services/assignment-service";
import {
  isProductionPostApprovalCode,
  PRODUCTION_POST_APPROVAL_CODES,
} from "@/lib/services/production-workflow";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import { TEXTILE_APPROVAL_OWNER_ROLE } from "@/lib/workflow/stage-capabilities";

type Tx = Prisma.TransactionClient;

/** Default minutes for textile ladder stages. */
const LADDER_MINUTES: Record<string, number> = {
  PROD_HANDOFF: 60,
  PROD_INSTRUCTION: 120,
  PROD_RELEASE: 60,
  LIVE_REVIEW: 60,
};

const LADDER_ROLE_FALLBACK: Record<string, string> = {
  PROD_HANDOFF: "DESIGN_HEAD",
  PROD_INSTRUCTION: "PRODUCTION_HEAD",
  PROD_RELEASE: "PRODUCTION_HEAD",
  LIVE_REVIEW: "MANAGEMENT",
};

type LadderStage = { code: string; role: string; minutes: number; subProcessId: number; processId: number };

async function resolveLadderStages(
  tx: Tx,
  subs: Record<string, { id: number; processId: number }>,
  roles: Record<string, { id: number }>,
): Promise<LadderStage[]> {
  const masters = await tx.designSubProcessMaster.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      processId: true,
      capabilities: true,
      defaultRole: { select: { code: true } },
    },
  });

  const fromCaps = masters
    .filter((m) =>
      resolveStageBehavior({
        code: m.code,
        capabilities: m.capabilities,
        defaultRoleCode: m.defaultRole?.code,
      }).unlockAfterDesignApproved,
    )
    .map((m) => {
      const roleCode =
        m.defaultRole?.code ??
        LADDER_ROLE_FALLBACK[m.code] ??
        TEXTILE_APPROVAL_OWNER_ROLE[m.code] ??
        "PRODUCTION_HEAD";
      return {
        code: m.code,
        role: roleCode,
        minutes: LADDER_MINUTES[m.code] ?? 60,
        subProcessId: m.id,
        processId: m.processId,
      };
    });

  // Prefer capability-tagged stages; fall back to textile ladder codes if none tagged yet.
  let stages: LadderStage[] =
    fromCaps.length > 0
      ? fromCaps
      : PRODUCTION_POST_APPROVAL_CODES.flatMap((code) => {
          const sub = subs[code];
          if (!sub) return [];
          return [
            {
              code,
              role: LADDER_ROLE_FALLBACK[code] ?? "PRODUCTION_HEAD",
              minutes: LADDER_MINUTES[code] ?? 60,
              subProcessId: sub.id,
              processId: sub.processId,
            } satisfies LadderStage,
          ];
        });

  // Stable order: textile order first, then any custom unlock stages.
  const textileOrder = [...PRODUCTION_POST_APPROVAL_CODES] as string[];
  stages = [...stages].sort((a, b) => {
    const ai = textileOrder.indexOf(a.code);
    const bi = textileOrder.indexOf(b.code);
    if (ai === -1 && bi === -1) return a.code.localeCompare(b.code);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const missingRoles = [...new Set(stages.map((s) => s.role))].filter((code) => !roles[code]);
  if (missingRoles.length) {
    throw createAppError(
      APP_ERROR_CODES.VALIDATION_FAILED,
      422,
      undefined,
      `Cannot create production stages - missing roles: ${missingRoles.join(", ")}.`,
    );
  }

  return stages;
}

/**
 * After management approval chain completes (design → APPROVED), unlock Design Head handoff task.
 */
export async function unlockProductionHandoffTask(
  tx: Tx,
  designId: bigint,
  correlationId: string,
): Promise<bigint | null> {
  // Prefer PROD_HANDOFF; otherwise first unlockAfterDesignApproved PENDING task.
  const candidates = await tx.designTask.findMany({
    where: {
      designId,
      status: "PENDING",
    },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      assignedEmployeeId: true,
      assignedRoleId: true,
      requiredSkillId: true,
      subProcessId: true,
      subProcess: { select: { code: true, capabilities: true } },
    },
  });

  const handoffTask =
    candidates.find((t) => t.subProcess.code === "PROD_HANDOFF") ??
    candidates.find((t) =>
      isProductionPostApprovalCode(t.subProcess.code, t.subProcess.capabilities),
    ) ??
    null;
  if (!handoffTask) return null;

  const design = await tx.designConcept.findUnique({
    where: { id: designId },
    select: { designHeadEmployeeId: true },
  });

  let assigneeId =
    handoffTask.assignedEmployeeId ?? design?.designHeadEmployeeId ?? null;
  if (!assigneeId) {
    assigneeId = await resolveAssigneeForDesignTask(
      {
        assignedRoleId: handoffTask.assignedRoleId,
        requiredSkillId: handoffTask.requiredSkillId,
        designId,
        subProcessId: handoffTask.subProcessId,
        subProcessCode: handoffTask.subProcess.code,
      },
      { tx },
    );
  }

  await tx.designTask.update({
    where: { id: handoffTask.id },
    data: {
      status: "ASSIGNED",
      assignedEmployeeId: assigneeId,
      version: { increment: 1 },
    },
  });

  if (assigneeId != null) {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      { taskId: handoffTask.id.toString(), employeeId: assigneeId },
      correlationId,
    );
  }

  return handoffTask.id;
}

/**
 * Idempotent: creates any missing PROD_* / LIVE_REVIEW stages (fills partial ladders too).
 */
export async function appendProductionStageTasks(
  tx: Tx,
  designId: bigint,
  subs: Record<string, { id: number; processId: number }>,
  roles: Record<string, { id: number }>,
): Promise<{ created: number }> {
  const ladderStages = await resolveLadderStages(tx, subs, roles);
  if (ladderStages.length === 0) return { created: 0 };

  const ladderCodes = ladderStages.map((s) => s.code);
  const existingRows = await tx.designTask.findMany({
    where: {
      designId,
      subProcess: { code: { in: ladderCodes } },
    },
    select: { subProcess: { select: { code: true } } },
  });
  const existingCodes = new Set(existingRows.map((r) => r.subProcess.code));
  const missing = ladderStages.filter((s) => !existingCodes.has(s.code));
  if (missing.length === 0) return { created: 0 };

  const maxSeq = await tx.designTask.aggregate({
    where: { designId },
    _max: { sequence: true, dependencySequence: true },
  });
  let nextSeq = (maxSeq._max.sequence ?? 0) + 1;
  let nextDep = (maxSeq._max.dependencySequence ?? maxSeq._max.sequence ?? 0) + 1;

  let created = 0;
  for (const stage of missing) {
    const role = roles[stage.role];
    const skillId = await resolveSkillIdForStageCode(tx, stage.code);
    const assignee = await resolveEmployeeForRole(role.id, { skillId, tx });

    await tx.designTask.create({
      data: {
        designId,
        processId: stage.processId,
        subProcessId: stage.subProcessId,
        assignedRoleId: role.id,
        requiredSkillId: skillId,
        assignedEmployeeId: assignee,
        status: "PENDING",
        priority: "HIGH",
        expectedMinutes: stage.minutes,
        sequence: nextSeq,
        dependencySequence: nextDep,
      },
    });
    nextSeq += 1;
    nextDep += 1;
    created += 1;
  }

  return { created };
}

/** Load masters needed by appendProductionStageTasks. */
export async function loadProductionLadderMaps(tx: Tx): Promise<{
  subs: Record<string, { id: number; processId: number }>;
  roles: Record<string, { id: number }>;
}> {
  const [subsRows, rolesRows] = await Promise.all([
    tx.designSubProcessMaster.findMany({
      select: { id: true, code: true, processId: true },
    }),
    tx.role.findMany({ select: { id: true, code: true } }),
  ]);

  return {
    subs: Object.fromEntries(
      subsRows.map((s) => [s.code, { id: s.id, processId: s.processId }]),
    ),
    roles: Object.fromEntries(rolesRows.map((r) => [r.code, { id: r.id }])),
  };
}

/**
 * Spec 8-Step / custom patterns omit PROD_*. Append ladder if missing, then unlock handoff.
 * Shared by final APPROVED, repair script, and Production Desk ensure-ladder API.
 */
export async function ensureProductionLadderAndUnlock(
  tx: Tx,
  designId: bigint,
  correlationId: string,
): Promise<{ appended: boolean; unlockedTaskId: bigint | null }> {
  const { subs, roles } = await loadProductionLadderMaps(tx);
  const { created } = await appendProductionStageTasks(tx, designId, subs, roles);
  const unlockedTaskId = await unlockProductionHandoffTask(tx, designId, correlationId);
  return { appended: created > 0, unlockedTaskId };
}

/**
 * Heal APPROVED designs (Spec 8-Step / custom) missing PROD_* tasks.
 * Optional designId limits to one design; otherwise all APPROVED.
 */
export async function ensureLadderForApprovedDesigns(
  actorId: number,
  correlationId: string,
  designId?: bigint,
): Promise<Array<{ designId: string; ideaRef: string; appended: boolean; unlocked: boolean }>> {
  const { prisma } = await import("@/lib/db");
  const { writeAuditLog } = await import("@/lib/audit");

  if (designId != null) {
    const design = await prisma.designConcept.findUnique({
      where: { id: designId },
      select: { id: true, ideaRef: true, status: true },
    });
    if (!design) {
      throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
    }
    if (design.status !== "APPROVED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        `Production stages can only be ensured for APPROVED designs (current status: ${design.status}).`,
      );
    }
  }

  const designs = await prisma.designConcept.findMany({
    where: {
      status: "APPROVED",
      ...(designId != null ? { id: designId } : {}),
    },
    select: { id: true, ideaRef: true },
    orderBy: { updatedAtUtc: "desc" },
    take: 200,
  });

  const results: Array<{
    designId: string;
    ideaRef: string;
    appended: boolean;
    unlocked: boolean;
  }> = [];

  for (const design of designs) {
    const outcome = await prisma.$transaction(async (tx) => {
      const ensured = await ensureProductionLadderAndUnlock(
        tx,
        design.id,
        `${correlationId}-ladder-${design.id}`,
      );
      if (ensured.appended || ensured.unlockedTaskId != null) {
        await writeAuditLog(tx, {
          entityType: "DesignConcept",
          entityId: design.id.toString(),
          action: "ENSURE_PRODUCTION_LADDER",
          userId: actorId,
          correlationId,
          after: {
            appended: ensured.appended,
            unlockedTaskId: ensured.unlockedTaskId?.toString() ?? null,
          },
        });
      }
      return ensured;
    });

    const { healStuckProdReleaseChecking } = await import(
      "@/lib/services/production-service"
    );
    await healStuckProdReleaseChecking(
      design.id,
      actorId,
      `${correlationId}-heal-release-${design.id}`,
    );

    results.push({
      designId: design.id.toString(),
      ideaRef: design.ideaRef,
      appended: outcome.appended,
      unlocked: outcome.unlockedTaskId != null,
    });
  }

  return results;
}

