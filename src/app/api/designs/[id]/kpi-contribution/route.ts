import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { getDesignTeamContribution } from "@/lib/services/design-kpi-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await params;
    const contributors = await getDesignTeamContribution(BigInt(id));
    return jsonOk(serializeBigInt({ contributors }), ctx.correlationId);
  });
}
