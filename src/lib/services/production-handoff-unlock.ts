import type { Prisma } from "@prisma/client";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";

type Tx = Prisma.TransactionClient;

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

export async function appendProductionStageTasks(
  tx: Tx,
  designId: bigint,
  subs: Record<string, { id: number; processId: number }>,
  roles: Record<string, { id: number }>,
): Promise<void> {
  const existing = await tx.designTask.findFirst({
    where: { designId, subProcess: { code: "PROD_HANDOFF" } },
  });
  if (existing) return;

  const maxSeq = await tx.designTask.aggregate({
    where: { designId },
    _max: { sequence: true, dependencySequence: true },
  });
  const baseSeq = maxSeq._max.sequence ?? 0;
  const baseDep = maxSeq._max.dependencySequence ?? baseSeq;

  const stages = [
    {
      code: "PROD_HANDOFF",
      role: "DESIGN_HEAD",
      sequence: baseSeq + 1,
      dep: baseDep + 1,
      minutes: 60,
    },
    {
      code: "PROD_INSTRUCTION",
      role: "PRODUCTION_HEAD",
      sequence: baseSeq + 2,
      dep: baseDep + 2,
      minutes: 120,
    },
    {
      code: "PROD_RELEASE",
      role: "PRODUCTION_HEAD",
      sequence: baseSeq + 3,
      dep: baseDep + 3,
      minutes: 60,
    },
    {
      code: "LIVE_REVIEW",
      role: "MANAGEMENT",
      sequence: baseSeq + 4,
      dep: baseDep + 4,
      minutes: 60,
    },
  ] as const;

  for (const stage of stages) {
    const sub = subs[stage.code];
    const role = roles[stage.role];
    if (!sub || !role) continue;

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
        sequence: stage.sequence,
        dependencySequence: stage.dep,
      },
    });
  }
}