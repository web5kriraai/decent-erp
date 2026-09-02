import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getTeamPipelineDependencies } from "@/lib/services/action-center-service";

const SUPERVISOR_PERMISSIONS = [
  PERMISSIONS.DESIGN_CREATE,
  PERMISSIONS.KPI_ADMIN,
  PERMISSIONS.MASTER_ADMIN,
] as const;

export async function GET() {
  return withApiHandler([...SUPERVISOR_PERMISSIONS], async (ctx) => {
    const items = await getTeamPipelineDependencies();
    return jsonOk(serializeBigInt(items), ctx.correlationId);
  });
}
