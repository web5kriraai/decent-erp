import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getMaterialAnalysisReport } from "@/lib/services/report-datasets-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const report = await getMaterialAnalysisReport();
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}
