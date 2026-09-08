import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().positive().optional(),
  subProcessId: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.qualityChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!existing) throw new ApiError("Checklist item not found", 404);

    const updated = await prisma.qualityChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sequence !== undefined ? { sequence: body.sequence } : {}),
        ...(body.subProcessId !== undefined ? { subProcessId: body.subProcessId } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      include: { subProcess: { select: { id: true, code: true, name: true } } },
    });

    await writeAuditLogDirect({
      entityType: "QualityChecklistItem",
      entityId: String(itemId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(updated, ctx.correlationId);
  });
}
