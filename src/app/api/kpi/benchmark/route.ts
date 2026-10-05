import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getKpiBenchmark } from "@/lib/services/kpi-benchmark-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const url = new URL(request.url);
    const now = new Date();
    const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
    const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);
    const roleIdRaw = url.searchParams.get("roleId");
    const roleId = roleIdRaw ? Number(roleIdRaw) : undefined;

    const report = await getKpiBenchmark({
      companyId: ctx.companyId,
      year: Number.isFinite(year) ? year : now.getUTCFullYear(),
      month:
        Number.isFinite(month) && month >= 1 && month <= 12
          ? month
          : now.getUTCMonth() + 1,
      roleId: roleId != null && Number.isFinite(roleId) ? roleId : undefined,
    });

    return jsonOk(report, ctx.correlationId);
  });
}
