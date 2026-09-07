import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Serialize START/RESUME (and any path that sets RUNNING) for one employee.
 * Spec §14: atomic check that the employee has no other RUNNING task.
 *
 * Uses a transaction-scoped advisory lock keyed by employee id so two concurrent
 * START requests cannot both observe "no RUNNING task" and both succeed.
 */
export async function lockEmployeeTaskMutation(tx: Tx, employeeId: number): Promise<void> {
  // pg_advisory_xact_lock(key1, key2) - namespace 0x5441534B ("TASK") + employeeId
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(0x5441534B, ${employeeId}::int)`;
}

/**
 * Lock + assert this employee has no other RUNNING task (excluding `taskId`).
 * Call inside the same transaction before setting status to RUNNING.
 */
export async function assertEmployeeHasNoOtherRunningTask(
  tx: Tx,
  employeeId: number,
  taskId: bigint,
): Promise<{ ok: true } | { ok: false; runningTaskId: bigint }> {
  await lockEmployeeTaskMutation(tx, employeeId);
  const running = await tx.designTask.findFirst({
    where: {
      assignedEmployeeId: employeeId,
      status: "RUNNING",
      id: { not: taskId },
    },
    select: { id: true },
  });
  if (running) {
    return { ok: false, runningTaskId: running.id };
  }
  return { ok: true };
}
