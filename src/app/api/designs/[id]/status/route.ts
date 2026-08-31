import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateDesignStatus } from "@/lib/services/design-service";

const schema = z.object({
  status: z.enum([
    "DRAFT",
    "ACTIVE",
    "ON_HOLD",
    "APPROVAL_PENDING",
    "APPROVED",
    "REJECTED",
    "PRODUCTION_RELEASED",
    "LIVE",
    "CLOSED",
  ]),
  version: z.number().int().positive(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const design = await updateDesignStatus(
      BigInt(id),
      body.status,
      body.version,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
