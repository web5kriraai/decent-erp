import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { calculateMonthlyKpi } from "@/lib/services/kpi-service";

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
    const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
    const results = await calculateMonthlyKpi(year, month);
    return jsonOk({ year, month, count: results.length }, ctx.correlationId);
  });
}
