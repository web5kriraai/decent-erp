import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignCompletionSummary } from "@/lib/services/design-summary-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.WORKFLOW_OVERRIDE, PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TIME_VIEW_TEAM],
    async (ctx) => {
      const { id } = await params;
      const summary = await getDesignCompletionSummary(BigInt(id));
      return jsonOk(serializeBigInt(summary), ctx.correlationId);
    },
  );
}
