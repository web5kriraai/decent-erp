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
    const seasonId = Number(id);
    if (!Number.isInteger(seasonId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!existing) throw new ApiError("Season not found", 404);

    const updated = await prisma.season.update({
      where: { id: seasonId },
      data: body,
    });

    await writeAuditLogDirect({
      entityType: "Season",
      entityId: String(seasonId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
