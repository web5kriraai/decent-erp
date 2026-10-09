import { consumeTimerIdempotencyKey, type TimerAction } from "@/lib/services/timer-idempotency-service";

export async function assertTimerIdempotency(
  request: Request,
  input: { taskId: bigint; employeeId: number; action: TimerAction },
): Promise<void> {
  const key = request.headers.get("Idempotency-Key");
  await consumeTimerIdempotencyKey({
    key,
    taskId: input.taskId,
    employeeId: input.employeeId,
    action: input.action,
  });
}
