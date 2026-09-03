import type { Prisma } from "@prisma/client";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { createAppError, notFound, businessRule } from "@/lib/errors/create-app-error";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";
import { PRODUCTION_POST_APPROVAL_CODES } from "@/lib/services/production-workflow";

type Tx = Prisma.TransactionClient;

const LADDER_STAGES = [
  { code: "PROD_HANDOFF", role: "DESIGN_HEAD", minutes: 60 },
  { code: "PROD_INSTRUCTION", role: "PRODUCTION_HEAD", minutes: 120 },
  { code: "PROD_RELEASE", role: "PRODUCTION_HEAD", minutes: 60 },
  { code: "LIVE_REVIEW", role: "MANAGEMENT", minutes: 60 },
] as const;

function assertLadderMasters(
  subs: Record<string, { id: number; processId: number }>,
  roles: Record<string, { id: number }>,
): void {
  const missingSubs = LADDER_STAGES.map((s) => s.code).filter((code) => !subs[code]);
  const missingRoles = [...new Set(LADDER_STAGES.map((s) => s.role))].filter(
    (code) => !roles[code],
  );
  if (missingSubs.length || missingRoles.length) {
    const parts: string[] = [];
    if (missingSubs.length) parts.push(`sub-processes: ${missingSubs.join(", ")}`);
    if (missingRoles.length) parts.push(`roles: ${missingRoles.join(", ")}`);
    throw createAppError(
      APP_ERROR_CODES.VALIDATION_FAILED,
      422,
      undefined,
      `Cannot create production stages — missing masters (${parts.join("; ")}). Seed masters first.`,
    );
  }
}

/**
 * After management approval chain completes (design → APPROVED), unlock Design Head handoff task.
 */
export async function unlockProductionHandoffTask(
  tx: Tx,
  designId: bigint,
  correlationId: string,
): Promise<bigint | null> {
  const handoffTask = await tx.designTask.findFirst({
    where: {
      designId,
      subProcess: { code: "PROD_HANDOFF" },
      status: "PENDING",
    },
    select: {
      id: true,
      assignedEmployeeId: true,
      assignedRoleId: true,
    },
  });
  if (!handoffTask) return null;

  const design = await tx.designConcept.findUnique({
    where: { id: designId },
    select: { designHeadEmployeeId: true },
  });

  let assigneeId =
    handoffTask.assignedEmployeeId ?? design?.designHeadEmployeeId ?? null;
  if (!assigneeId) {
    assigneeId = await resolveEmployeeForRole(handoffTask.assignedRoleId);
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
  assertLadderMasters(subs, roles);

  const existingRows = await tx.designTask.findMany({
    where: {
      designId,
      subProcess: { code: { in: [...PRODUCTION_POST_APPROVAL_CODES] } },
    },
    select: { subProcess: { select: { code: true } } },
  });
  const existingCodes = new Set(existingRows.map((r) => r.subProcess.code));
  const missing = LADDER_STAGES.filter((s) => !existingCodes.has(s.code));
  if (missing.length === 0) return { created: 0 };

  const maxSeq = await tx.designTask.aggregate({
    where: { designId },
    _max: { sequence: true, dependencySequence: true },
  });
  let nextSeq = (maxSeq._max.sequence ?? 0) + 1;
  let nextDep = (maxSeq._max.dependencySequence ?? maxSeq._max.sequence ?? 0) + 1;

  let created = 0;
  for (const stage of missing) {
    const sub = subs[stage.code];
    const role = roles[stage.role];
    const assignee = await resolveEmployeeForRole(role.id);

    await tx.designTask.create({
      data: {
        designId,
        processId: sub.processId,
        subProcessId: sub.id,
        assignedRoleId: role.id,
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
    results.push({
      designId: design.id.toString(),
      ideaRef: design.ideaRef,
      appended: outcome.appended,
      unlocked: outcome.unlockedTaskId != null,
    });
  }

  return results;
}

