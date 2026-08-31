import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getMyTasks } from "@/lib/services/task-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const tasks = await getMyTasks(ctx.employeeId);
    return jsonOk(serializeBigInt(tasks), ctx.correlationId);
  });
}
