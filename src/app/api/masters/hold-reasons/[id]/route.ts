import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  excludeFromActiveTime: z.boolean().optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const reasonId = Number(id);
    if (!Number.isInteger(reasonId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.taskHoldReason.findUnique({ where: { id: reasonId } });
    if (!existing) throw new ApiError("Hold reason not found", 404);

    const updated = await prisma.taskHoldReason.update({
      where: { id: reasonId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.excludeFromActiveTime !== undefined
          ? { excludeFromActiveTime: body.excludeFromActiveTime }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "TaskHoldReason",
      entityId: String(reasonId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
