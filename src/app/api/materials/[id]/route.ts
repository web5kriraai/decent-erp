import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCanUpdateMaterialLine } from "@/lib/design-access";
import { updateMaterialLineStatus } from "@/lib/services/material-service";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["REQUESTED", "INDENT", "AVAILABLE", "ISSUED", "CANCELLED"]),
  wastageQty: z.number().nonnegative().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(
    [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_CREATE, PERMISSIONS.PRODUCTION_RELEASE],
    async (ctx) => {
      const { id } = await context.params;
      let lineId: bigint;
      try {
        lineId = BigInt(id);
      } catch {
        throw new ApiError("Invalid id", 400);
      }
      await assertCanUpdateMaterialLine({
        lineId,
        employeeId: ctx.employeeId,
        permissions: ctx.permissions,
      });
      const body = await parseBody(request, patchSchema);
      const updated = await updateMaterialLineStatus({
        id: lineId,
        status: body.status,
        wastageQty: body.wastageQty,
        issuedById: ctx.employeeId,
      });
      return jsonOk(serializeBigInt(updated), ctx.correlationId);
    },
  );
}
