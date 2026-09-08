import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { roleKpiWeightsSumOk } from "@/lib/services/kpi-weight-utils";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  weightPercent: z.number().positive().max(100),
  target: z.number().optional().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const defId = Number(id);
    if (!Number.isInteger(defId)) throw new ApiError("Invalid id", 400);
    const body = await parseBody(request, patchSchema);
    const existing = await prisma.employeeKpiDefinition.findUnique({ where: { id: defId } });
    if (!existing) throw new ApiError("KPI definition not found", 404);

    const siblings = await prisma.employeeKpiDefinition.findMany({
      where: { roleId: existing.roleId },
      select: { id: true, weightPercent: true },
    });
    const projected = siblings.map((d) =>
      d.id === defId ? body.weightPercent : Number(d.weightPercent),
    );
    const { ok, sum } = roleKpiWeightsSumOk(projected);
    if (!ok) {
      throw new ApiError(
        `KPI weights for this role must sum to 100% (would be ${sum.toFixed(2)}%)`,
        400,
      );
    }

    const updated = await prisma.employeeKpiDefinition.update({
      where: { id: defId },
      data: {
        weightPercent: body.weightPercent,
        ...(body.target !== undefined ? { target: body.target } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "EmployeeKpiDefinition",
      entityId: String(defId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(updated, ctx.correlationId);
  });
}
