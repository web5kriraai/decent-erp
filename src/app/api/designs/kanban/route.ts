import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { listDesignsForKanban } from "@/lib/services/design-service";

export async function GET() {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const designs = await listDesignsForKanban();
    return jsonOk(serializeBigInt(designs), ctx.correlationId);
  });
}
