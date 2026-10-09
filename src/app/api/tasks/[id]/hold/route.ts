import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { holdTask } from "@/lib/services/task-service";
import { assertTimerIdempotency } from "@/lib/timer-route-utils";

const schema = z.object({
  holdReasonId: z.number().int().positive(),
  remark: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const taskId = BigInt(id);
    await assertTimerIdempotency(request, {
      taskId,
      employeeId: ctx.employeeId,
      action: "HOLD",
    });
    const task = await holdTask(
      taskId,
      ctx.employeeId,
      body.holdReasonId,
      body.remark,
      ctx.correlationId,
      body.version,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
