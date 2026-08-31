import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listApprovedDesigns,
  releaseToProduction,
} from "@/lib/services/production-service";

const releaseSchema = z.object({
  designId: z.string(),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const designs = await listApprovedDesigns();
    return jsonOk(serializeBigInt(designs), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, releaseSchema);
    if (!/^\d+$/.test(body.designId)) throw new ApiError("Invalid design id", 400);
    const design = await releaseToProduction(
      BigInt(body.designId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
