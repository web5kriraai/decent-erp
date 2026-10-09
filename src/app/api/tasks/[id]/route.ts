import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getTaskTimeDetail } from "@/lib/services/time-service";

type RouteContext = { params: Promise<{ id: string }> };

function parseTaskId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) {
    throw new ApiError("Invalid task id", 400);
  }
  return BigInt(raw);
}

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await context.params;
    const task = await getTaskTimeDetail(
      parseTaskId(id),
      ctx.employeeId,
      ctx.permissions,
      ctx.companyId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
