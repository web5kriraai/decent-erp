import { withApiHandler, jsonOk } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { validateProductionReleaseReadiness } from "@/lib/services/production-release-readiness";
import { getFloorErpProgress } from "@/lib/services/erp-stage-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withApiHandler(
    [PERMISSIONS.COST_VIEW, PERMISSIONS.PRODUCTION_RELEASE, PERMISSIONS.TASK_EXECUTE],
    async (ctx) => {
      const readiness = await validateProductionReleaseReadiness(BigInt(id));
      const floor = await getFloorErpProgress(BigInt(id));
      const missing = [
        ...readiness.missing,
        ...floor.missing.map((m) => `Floor ERP · ${m}`),
      ];
      return jsonOk(
        {
          ok: readiness.ok && floor.ok,
          missing,
          floor: {
            ok: floor.ok,
            completed: floor.completed,
            total: floor.total,
          },
        },
        ctx.correlationId,
      );
    },
  );
}
