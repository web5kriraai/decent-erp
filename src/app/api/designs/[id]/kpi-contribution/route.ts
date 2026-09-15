import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignTeamContribution } from "@/lib/services/design-kpi-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.KPI_ADMIN, PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TIME_VIEW_TEAM],
    async (ctx) => {
      const { id } = await params;
      const contributors = await getDesignTeamContribution(BigInt(id));
      return jsonOk(serializeBigInt({ contributors }), ctx.correlationId);
    },
  );
}
