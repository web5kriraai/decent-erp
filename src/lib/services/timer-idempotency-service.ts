import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

const TTL_MS = 24 * 60 * 60 * 1000;

export type TimerAction = "START" | "HOLD" | "RESUME" | "END";

export async function consumeTimerIdempotencyKey(input: {
  key: string | null | undefined;
  taskId: bigint;
  employeeId: number;
  action: TimerAction;
}): Promise<void> {
  if (!input.key?.trim()) return;

  const key = input.key.trim();
  const existing = await prisma.taskTimerIdempotency.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing) {
    if (
      existing.taskId === input.taskId &&
      existing.employeeId === input.employeeId &&
      existing.action === input.action
    ) {
      throw new ApiError("Duplicate timer request (idempotency key already used)", 409, {
        idempotentReplay: true,
      });
    }
    throw new ApiError("Idempotency key conflict", 409);
  }

  await prisma.taskTimerIdempotency.create({
    data: {
      idempotencyKey: key,
      taskId: input.taskId,
      employeeId: input.employeeId,
      action: input.action,
    },
  });

  const cutoff = new Date(Date.now() - TTL_MS);
  await prisma.taskTimerIdempotency.deleteMany({
    where: { createdAtUtc: { lt: cutoff } },
  });
}
