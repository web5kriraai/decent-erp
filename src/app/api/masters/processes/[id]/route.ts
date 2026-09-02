import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  getProcessUsage,
  type MasterUsageWarning,
} from "@/lib/services/master-usage-service";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const processId = Number(id);
    if (!Number.isInteger(processId)) throw new ApiError("Invalid id", 400);
    const body = await parseBody(request, patchSchema);
    const existing = await prisma.designProcessMaster.findUnique({
      where: { id: processId },
      include: { subProcesses: { select: { id: true, active: true } } },
    });
    if (!existing) throw new ApiError("Process not found", 404);

    const deactivating = body.active === false && existing.active === true;
    let warnings: MasterUsageWarning[] = [];
    if (deactivating) {
      warnings = await getProcessUsage(processId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (deactivating) {
        await tx.designSubProcessMaster.updateMany({
          where: { processId, active: true },
          data: { active: false },
        });
      }
      return tx.designProcessMaster.update({
        where: { id: processId },
        data: body,
        include: { subProcesses: { orderBy: { sequence: "asc" } } },
      });
    });

    await writeAuditLogDirect({
      entityType: "DesignProcessMaster",
      entityId: String(processId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(
      {
        ...serializeBigInt(updated),
        warnings,
      },
      ctx.correlationId,
    );
  });
}
