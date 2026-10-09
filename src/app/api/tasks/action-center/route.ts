import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getActionCenter } from "@/lib/services/action-center-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "10");
    const center = await getActionCenter(ctx.employeeId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      q: params.get("q") ?? undefined,
      priority: params.get("priority") ?? undefined,
      stage: params.get("stage") ?? undefined,
    });
    return jsonOk(serializeBigInt(center), ctx.correlationId);
  });
}
