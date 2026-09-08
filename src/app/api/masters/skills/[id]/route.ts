import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  defaultRoleId: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const skillId = Number(id);
    if (!Number.isInteger(skillId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!existing) throw new ApiError("Skill not found", 404);

    const updated = await prisma.skill.update({
      where: { id: skillId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.defaultRoleId !== undefined ? { defaultRoleId: body.defaultRoleId } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "Skill",
      entityId: String(skillId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
