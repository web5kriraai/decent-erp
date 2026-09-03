import { z } from "zod";
import { jsonError, jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import {
  assertErpStageActionAllowed,
  ERP_CHAIN_VIEW_PERMISSIONS,
} from "@/lib/erp-rbac";
import { completeErpStage, startErpStage } from "@/lib/services/erp-stage-service";
import { permissionDeniedMessage } from "@/lib/user-messages";

const bodySchema = z.object({
  action: z.enum(["start", "complete"]),
  qty: z.number().int().optional(),
  wastageQty: z.number().int().min(0).optional(),
  amount: z.number().min(0).optional(),
  lotRef: z.string().max(120).optional(),
  invoiceRef: z.string().max(120).optional(),
  remark: z.string().max(2000).optional(),
  marginPercent: z.number().min(-100).max(100).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctxParams: Ctx) {
  return withApiHandler(ERP_CHAIN_VIEW_PERMISSIONS, async (ctx) => {
    const { id } = await ctxParams.params;
    if (!/^\d+$/.test(id)) {
      return jsonError("Invalid stage id", 400, ctx.correlationId);
    }
    const body = bodySchema.parse(await req.json());
    const stageId = BigInt(id);

    const existing = await prisma.erpStageRecord.findUnique({
      where: { id: stageId },
      select: { erpModule: true, status: true },
    });
    if (!existing) {
      return jsonError("ERP stage not found", 404, ctx.correlationId);
    }

    const gate = assertErpStageActionAllowed(
      ctx.permissions,
      existing.erpModule,
      existing.status,
      body.action,
    );
    if (!gate.ok) {
      return jsonError(
        gate.permission ? permissionDeniedMessage(gate.permission) : gate.message,
        gate.status,
        ctx.correlationId,
        undefined,
        gate.status === 403 ? "PERMISSION_DENIED" : undefined,
      );
    }

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
