import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getDesignSuccessReport,
} from "@/lib/services/kpi-service";
import { upsertDesignSuccessMetric } from "@/lib/services/production-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") ?? new Date().getUTCFullYear());
    const month = Number(searchParams.get("month") ?? new Date().getUTCMonth() + 1);
    const report = await getDesignSuccessReport(year, month);
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}

const upsertSchema = z.object({
  designId: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  productionQty: z.number().int().optional(),
  salesQty: z.number().int().optional(),
  salesValue: z.number().optional(),
  returnQty: z.number().int().optional(),
  marginPercent: z.number().optional(),
  repeatOrders: z.number().int().optional(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, upsertSchema);
    const metric = await upsertDesignSuccessMetric(BigInt(body.designId), body);
    return jsonOk(serializeBigInt(metric), ctx.correlationId, 201);
  });
}
