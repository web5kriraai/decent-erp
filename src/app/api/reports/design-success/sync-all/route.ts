import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { batchSyncDesignSuccessFromErp } from "@/lib/services/design-success-batch-sync";

const schema = z.object({
  periodYear: z.number().int().min(2000).max(2100).optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/** KPI_ADMIN: batch pull design-success metrics from partner ERP for the period. */
export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, schema);
    const result = await batchSyncDesignSuccessFromErp({
      periodYear: body.periodYear,
      periodMonth: body.periodMonth,
      companyId: ctx.companyId,
      limit: body.limit,
    });
    return jsonOk(result, ctx.correlationId);
  });
}
