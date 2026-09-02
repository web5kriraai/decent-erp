import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const productTypeId = Number(id);
    if (!Number.isInteger(productTypeId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.productType.findUnique({ where: { id: productTypeId } });
    if (!existing) throw new ApiError("Product type not found", 404);

    const updated = await prisma.productType.update({
      where: { id: productTypeId },
      data: body,
    });

    await writeAuditLogDirect({
      entityType: "ProductType",
      entityId: String(productTypeId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
