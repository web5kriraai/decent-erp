import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateCorrection } from "@/lib/services/correction-service";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "REJECTED"]).optional(),
  rootCause: z.string().optional(),
  extraMinutes: z.number().int().min(0).optional().nullable(),
  extraCost: z.number().nonnegative().optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.CORRECTION_RAISE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const correction = await updateCorrection(
      BigInt(id),
      {
        status: body.status,
        rootCause: body.rootCause,
        extraMinutes: body.extraMinutes ?? undefined,
        extraCost: body.extraCost ?? undefined,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId);
  });
}
