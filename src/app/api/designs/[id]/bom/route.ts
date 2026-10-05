import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createBomLine,
  listBomLines,
  bomRollupCost,
} from "@/lib/services/bom-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.COST_VIEW, PERMISSIONS.TASK_EXECUTE],
    async (ctx) => {
      const { id } = await params;
      const designId = BigInt(id);
      const [lines, rollup] = await Promise.all([
        listBomLines(designId, ctx.companyId),
        bomRollupCost(designId, ctx.companyId),
      ]);
      return jsonOk(serializeBigInt({ lines, rollup }), ctx.correlationId);
    },
  );
}

const createSchema = z.object({
  parentLineId: z.string().optional().nullable(),
  sequence: z.number().int().positive().optional(),
  itemCode: z.string().max(60).optional(),
  itemName: z.string().min(1).max(200),
  catalogItemId: z.number().int().positive().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().max(20).optional(),
  wastePercent: z.number().min(0).max(100).optional().nullable(),
  estimatedUnitCost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.COST_VIEW],
    async (ctx) => {
      const { id } = await params;
      const body = await parseBody(request, createSchema);
      const line = await createBomLine(BigInt(id), ctx.companyId, body);
      return jsonOk(serializeBigInt(line), ctx.correlationId, 201);
    },
  );
}
