import { jsonError, jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listProductionHandoffs,
  syncProductionHandoff,
} from "@/lib/services/erp-handoff-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const designId = new URL(request.url).searchParams.get("designId");
    const handoffs = await listProductionHandoffs(designId ? BigInt(designId) : undefined);
    return jsonOk(serializeBigInt(handoffs), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = (await request.json()) as { handoffId?: string };
    if (!body.handoffId) {
      return jsonError("handoffId required", 400, ctx.correlationId);
    }
    const handoff = await syncProductionHandoff(
      BigInt(body.handoffId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(handoff), ctx.correlationId);
  });
}
