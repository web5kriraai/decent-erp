import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getManagementWorkbenchSummary } from "@/lib/services/workbench-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const summary = await getManagementWorkbenchSummary();
    return jsonOk(summary, ctx.correlationId);
  });
}
