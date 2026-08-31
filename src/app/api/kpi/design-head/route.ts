import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignHeadKpi } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const scores = await getDesignHeadKpi();
    return jsonOk(serializeBigInt(scores), ctx.correlationId);
  });
}
