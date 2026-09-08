import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const levelId = Number(id);
    if (!Number.isInteger(levelId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.approvalLevel.findUnique({ where: { id: levelId } });
    if (!existing) throw new ApiError("Approval level not found", 404);

    const updated = await prisma.approvalLevel.update({
      where: { id: levelId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sequence !== undefined ? { sequence: body.sequence } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "ApprovalLevel",
      entityId: String(levelId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(updated, ctx.correlationId);
  });
}
