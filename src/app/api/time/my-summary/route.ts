import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeTimeSummary } from "@/lib/services/time-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const summary = await getEmployeeTimeSummary(ctx.employeeId);
    return jsonOk(serializeBigInt(summary), ctx.correlationId);
  });
}
