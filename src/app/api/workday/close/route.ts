import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { closeWorkday } from "@/lib/services/task-service";

export async function POST() {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const result = await closeWorkday(ctx.employeeId, ctx.correlationId);
    return jsonOk(result, ctx.correlationId);
  });
}
