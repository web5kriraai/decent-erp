import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getAdminDashboardStats } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const stats = await getAdminDashboardStats();
    return jsonOk(stats, ctx.correlationId);
  });
}
