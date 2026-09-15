import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { createMaterialLine, listMaterialLines } from "@/lib/services/material-service";

const createSchema = z.object({
  designId: z.union([z.string(), z.number()]),
  catalogItemId: z.number().int().positive(),
  unit: z.string().min(1).max(20).default("pcs"),
  quantity: z.number().positive(),
  source: z.enum(["STOCK", "PURCHASE_INDENT"]),
  remark: z.string().max(2000).optional(),
});

const MATERIALS_VIEW_PERMISSIONS = [
  PERMISSIONS.DESIGN_CREATE,
  PERMISSIONS.PRODUCTION_RELEASE,
  PERMISSIONS.TASK_EXECUTE,
  PERMISSIONS.COST_VIEW,
  PERMISSIONS.MASTER_ADMIN,
] as const;

export async function GET(request: Request) {
  return withApiHandler([...MATERIALS_VIEW_PERMISSIONS], async (ctx) => {
    const designIdParam = new URL(request.url).searchParams.get("designId");
    const designId = designIdParam ? BigInt(designIdParam) : undefined;
    const rows = await listMaterialLines(designId);
    return jsonOk(serializeBigInt(rows), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const created = await createMaterialLine({
      designId: BigInt(body.designId),
      catalogItemId: body.catalogItemId,
      unit: body.unit,
      quantity: body.quantity,
      source: body.source,
      remark: body.remark,
      requestedById: ctx.employeeId,
    });
    return jsonOk(serializeBigInt(created), ctx.correlationId, 201);
  });
}
