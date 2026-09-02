import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { syncDesignHandoffs } from "@/lib/services/erp-handoff-service";

const schema = z.object({
  designId: z.string().min(1),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, schema);
    const results = await syncDesignHandoffs(
      BigInt(body.designId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(results), ctx.correlationId);
  });
}
