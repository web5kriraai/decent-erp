import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignWorkflowDashboard } from "@/lib/services/design-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "10");
    const dashboard = await getDesignWorkflowDashboard(ctx.companyId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      q: params.get("q") ?? "",
      product: params.get("product") ?? "ALL",
      seasonId: params.get("seasonId") ?? "ALL",
      owner: params.get("owner") ?? "ALL",
      priority: params.get("priority") ?? "ALL",
    });
    return jsonOk(serializeBigInt(dashboard), ctx.correlationId);
  });
}
