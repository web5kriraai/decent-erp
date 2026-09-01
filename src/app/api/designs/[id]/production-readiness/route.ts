import { withApiHandler, jsonOk } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { validateProductionReleaseReadiness } from "@/lib/services/production-release-readiness";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withApiHandler(PERMISSIONS.COST_VIEW, async (ctx) => {
    const readiness = await validateProductionReleaseReadiness(BigInt(id));
    return jsonOk(readiness, ctx.correlationId);
  });
}
