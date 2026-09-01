import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { PRODUCTION_RETURN_REASON_CODES } from "@/lib/production-return-reasons";
import {
  getProductionReturnOptions,
  returnProductionForClarification,
} from "@/lib/services/production-return-service";

const returnSchema = z.object({
  designId: z.string(),
  reasonCode: z.enum(PRODUCTION_RETURN_REASON_CODES),
  routeToSubProcessId: z.number().int().positive(),
  remark: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const designId = new URL(request.url).searchParams.get("designId");
    if (!designId) {
      return jsonOk({ designs: [] }, ctx.correlationId);
    }
    const options = await getProductionReturnOptions(BigInt(designId));
    return jsonOk(options, ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, returnSchema);
    const result = await returnProductionForClarification(
      BigInt(body.designId),
      ctx.employeeId,
      {
        reasonCode: body.reasonCode,
        routeToSubProcessId: body.routeToSubProcessId,
        remark: body.remark,
      },
      ctx.correlationId,
    );
    return jsonOk(result, ctx.correlationId, 201);
  });
}
