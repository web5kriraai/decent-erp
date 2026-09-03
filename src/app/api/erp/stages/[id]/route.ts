import { z } from "zod";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { completeErpStage, startErpStage } from "@/lib/services/erp-stage-service";

const bodySchema = z.object({
  action: z.enum(["start", "complete"]),
  qty: z.number().int().min(0).optional(),
  wastageQty: z.number().int().min(0).optional(),
  amount: z.number().min(0).optional(),
  lotRef: z.string().max(120).optional(),
  invoiceRef: z.string().max(120).optional(),
  remark: z.string().max(2000).optional(),
  marginPercent: z.number().min(-100).max(100).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctxParams: Ctx) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const { id } = await ctxParams.params;
    const body = bodySchema.parse(await req.json());
    const stageId = BigInt(id);

    if (body.action === "start") {
      const stage = await startErpStage(stageId, ctx.employeeId, ctx.correlationId);
      return jsonOk(serializeBigInt(stage), ctx.correlationId);
    }

    const stage = await completeErpStage(stageId, ctx.employeeId, ctx.correlationId, {
      qty: body.qty,
      wastageQty: body.wastageQty,
      amount: body.amount,
      lotRef: body.lotRef,
      invoiceRef: body.invoiceRef,
      remark: body.remark,
      marginPercent: body.marginPercent,
    });
    return jsonOk(serializeBigInt(stage), ctx.correlationId);
  });
}
