import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeKpiDashboard } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const scores = await getEmployeeKpiDashboard();
    return jsonOk(serializeBigInt(scores), ctx.correlationId);
  });
}
