import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignerRankingReport } from "@/lib/services/report-datasets-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
    const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
    const report = await getDesignerRankingReport(
      Number.isInteger(year) ? year : undefined,
      Number.isInteger(month) ? month : undefined,
    );
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}
