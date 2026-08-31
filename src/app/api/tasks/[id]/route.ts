import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { getTaskTimeDetail } from "@/lib/services/time-service";

type RouteContext = { params: Promise<{ id: string }> };

function parseTaskId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) {
    throw new ApiError("Invalid task id", 400);
  }
  return BigInt(raw);
}

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await context.params;
    const task = await getTaskTimeDetail(parseTaskId(id), ctx.employeeId, ctx.permissions);
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
