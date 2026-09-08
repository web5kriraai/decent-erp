import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { upsertDesignCreativityRating } from "@/lib/services/design-kpi-service";

const bodySchema = z.object({
  employeeId: z.number().int().positive(),
  score: z.number().min(0).max(100),
  remark: z.string().max(2000).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, bodySchema);
    const rating = await upsertDesignCreativityRating({
      designId: BigInt(id),
      employeeId: body.employeeId,
      score: body.score,
      remark: body.remark,
      ratedById: ctx.employeeId,
      correlationId: ctx.correlationId,
    });
    return jsonOk(serializeBigInt(rating), ctx.correlationId);
  });
}
