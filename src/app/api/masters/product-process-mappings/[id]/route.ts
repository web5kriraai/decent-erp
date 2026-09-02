import { jsonOk, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const mappingId = Number(id);
    if (!Number.isInteger(mappingId)) throw new ApiError("Invalid id", 400);

    const existing = await prisma.productProcessMapping.findUnique({ where: { id: mappingId } });
    if (!existing) throw new ApiError("Mapping not found", 404);

    await prisma.productProcessMapping.delete({ where: { id: mappingId } });

    await writeAuditLogDirect({
      entityType: "ProductProcessMapping",
      entityId: String(mappingId),
      action: "DELETE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
    });

    return jsonOk({ deleted: true }, ctx.correlationId);
  });
}
