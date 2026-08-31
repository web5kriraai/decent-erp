import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { holdTask } from "@/lib/services/task-service";

const schema = z.object({
  holdReasonId: z.number().int().positive(),
  remark: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const task = await holdTask(
      BigInt(id),
      ctx.employeeId,
      body.holdReasonId,
      body.remark,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
