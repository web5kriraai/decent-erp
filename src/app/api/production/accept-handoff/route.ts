import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { acceptProductionHandoff } from "@/lib/services/production-accept-handoff-service";
import { z } from "zod";

const acceptSchema = z.object({
  designId: z.string(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, acceptSchema);
    const result = await acceptProductionHandoff(
      BigInt(body.designId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(result, ctx.correlationId);
  });
}
