import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getSampleStatusReport } from "@/lib/services/kpi-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
    const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
    const safeYear = Number.isFinite(year) ? year : now.getUTCFullYear();
    const safeMonth =
      Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1;
    const report = await getSampleStatusReport(safeYear, safeMonth);
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}
