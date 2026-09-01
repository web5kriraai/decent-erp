import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignHeadWorkbenchSummary } from "@/lib/services/workbench-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const summary = await getDesignHeadWorkbenchSummary(ctx.employeeId);
    return jsonOk(serializeBigInt(summary), ctx.correlationId);
  });
}
