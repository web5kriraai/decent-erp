import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateMaterialLineStatus } from "@/lib/services/material-service";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["REQUESTED", "INDENT", "AVAILABLE", "ISSUED", "CANCELLED"]),
  wastageQty: z.number().nonnegative().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await context.params;
    let lineId: bigint;
    try {
      lineId = BigInt(id);
    } catch {
      throw new ApiError("Invalid id", 400);
    }
    const body = await parseBody(request, patchSchema);
    const updated = await updateMaterialLineStatus({
      id: lineId,
      status: body.status,
      wastageQty: body.wastageQty,
      issuedById: ctx.employeeId,
    });
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
