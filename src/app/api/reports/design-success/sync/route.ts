import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ingestDesignSuccessFromErp } from "@/lib/services/erp-handoff-service";
import { assertSameCompany } from "@/lib/tenant";

const schema = z.object({
  designId: z.string().min(1),
  periodYear: z.number().int().min(2000).max(2100).optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, schema);
    const design = await prisma.designConcept.findUnique({
      where: { id: BigInt(body.designId) },
      select: { id: true, designNumber: true, ideaRef: true, companyId: true },
    });
    if (!design) {
      throw new ApiError("Design not found", 404);
    }
    assertSameCompany(design.companyId, ctx, "Design");
    const designNumber =
      design.designNumber ?? `DN-${design.ideaRef.replace(/^IDEA-/, "")}`;
    const result = await ingestDesignSuccessFromErp(design.id, designNumber, {
      periodYear: body.periodYear,
      periodMonth: body.periodMonth,
    });
    return jsonOk(
      serializeBigInt({
        ingested: result.ingested,
        mode: result.mode,
        reason: result.reason ?? null,
        metric: result.metric ?? null,
        designId: design.id.toString(),
        designNumber,
        periodYear: body.periodYear ?? null,
        periodMonth: body.periodMonth ?? null,
      }),
      ctx.correlationId,
    );
  });
}
