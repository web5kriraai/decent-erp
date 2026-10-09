import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { startTask } from "@/lib/services/task-service";
import { assertTimerIdempotency } from "@/lib/timer-route-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const taskId = BigInt(id);
    await assertTimerIdempotency(request, {
      taskId,
      employeeId: ctx.employeeId,
      action: "START",
    });
    const task = await startTask(taskId, ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
