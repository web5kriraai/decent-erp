import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getCorrectionAnalysisReport } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const report = await getCorrectionAnalysisReport();
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}
