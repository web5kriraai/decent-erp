import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { startTask } from "@/lib/services/task-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const task = await startTask(BigInt(id), ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
