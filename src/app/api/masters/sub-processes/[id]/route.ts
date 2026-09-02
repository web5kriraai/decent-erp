import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().positive().optional(),
  defaultRoleId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  isApproval: z.boolean().optional(),
  isFileRequired: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const subProcessId = Number(id);
    if (!Number.isInteger(subProcessId)) throw new ApiError("Invalid id", 400);
    const body = await parseBody(request, patchSchema);
    const existing = await prisma.designSubProcessMaster.findUnique({ where: { id: subProcessId } });
    if (!existing) throw new ApiError("Sub-process not found", 404);
    const updated = await prisma.designSubProcessMaster.update({
      where: { id: subProcessId },
      data: body,
    });
    await writeAuditLogDirect({
      entityType: "DesignSubProcessMaster",
      entityId: String(subProcessId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
