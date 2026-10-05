import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateBomLine } from "@/lib/services/bom-service";

const patchSchema = z.object({
  itemName: z.string().min(1).max(200).optional(),
  itemCode: z.string().max(60).optional().nullable(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  wastePercent: z.number().min(0).max(100).optional().nullable(),
  estimatedUnitCost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sequence: z.number().int().positive().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.COST_VIEW],
    async (ctx) => {
      const { lineId } = await params;
      const body = await parseBody(request, patchSchema);
      const line = await updateBomLine(BigInt(lineId), ctx.companyId, body);
      return jsonOk(serializeBigInt(line), ctx.correlationId);
    },
  );
}
