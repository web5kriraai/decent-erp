import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listReleasedDesignsForGoLive,
  markDesignLive,
} from "@/lib/services/production-service";

const schema = z.object({
  designId: z.string(),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const designs = await listReleasedDesignsForGoLive();
    return jsonOk(serializeBigInt(designs), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, schema);
    const design = await markDesignLive(BigInt(body.designId), ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
