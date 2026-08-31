import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { getWorkflowPatterns } from "@/lib/services/kpi-service";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const patterns = await getWorkflowPatterns();
    return jsonOk(serializeBigInt(patterns), ctx.correlationId);
  });
}
