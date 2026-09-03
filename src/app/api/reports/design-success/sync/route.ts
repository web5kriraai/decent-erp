import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ingestDesignSuccessFromErp } from "@/lib/services/erp-handoff-service";

const schema = z.object({
  designId: z.string().min(1),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, schema);
    const design = await prisma.designConcept.findUnique({
      where: { id: BigInt(body.designId) },
      select: { id: true, designNumber: true, ideaRef: true },
    });
    if (!design) {
      throw new ApiError("Design not found", 404);
    }
    const designNumber =
      design.designNumber ?? `DN-${design.ideaRef.replace(/^IDEA-/, "")}`;
    const result = await ingestDesignSuccessFromErp(design.id, designNumber);
    return jsonOk(
      serializeBigInt({
        ingested: result.ingested,
        mode: result.mode,
        reason: result.reason ?? null,
        metric: result.metric ?? null,
        designId: design.id.toString(),
        designNumber,
      }),
      ctx.correlationId,
    );
  });
}
