import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { ApiError } from "@/lib/errors/api-error";
import { PERMISSIONS } from "@/lib/permissions";
import { getRoleDayKpi } from "@/lib/services/executor-day-kpi";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? params.get("date") ?? "";
    const to = params.get("to") ?? params.get("date") ?? "";
    const kpi = await getRoleDayKpi(ctx.employeeId, ctx.companyId, ctx.roleCode, from, to);
    if (!kpi) throw new ApiError("Choose a valid date range", 400);
    return jsonOk(kpi, ctx.correlationId);
  });
}
