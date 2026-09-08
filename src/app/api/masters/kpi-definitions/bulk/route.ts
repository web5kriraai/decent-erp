import { z } from "zod";
import { jsonOk, parseBody, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { roleKpiWeightsSumOk } from "@/lib/services/kpi-weight-utils";

const bulkSchema = z.object({
  roleId: z.number().int().positive(),
  weights: z
    .array(
      z.object({
        id: z.number().int().positive(),
        weightPercent: z.number().positive().max(100),
      }),
    )
    .min(1),
});

/** Atomically update all KPI weights for one role (must total 100%). */
export async function PATCH(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const body = await parseBody(request, bulkSchema);

    const existing = await prisma.employeeKpiDefinition.findMany({
      where: { roleId: body.roleId },
    });
    if (existing.length === 0) {
      throw new ApiError("No KPI definitions for this role", 404);
    }

    const existingById = new Map(existing.map((d) => [d.id, d]));
    for (const row of body.weights) {
      if (!existingById.has(row.id)) {
        throw new ApiError(`KPI definition ${row.id} does not belong to this role`, 400);
      }
    }

    const weightById = new Map(body.weights.map((w) => [w.id, w.weightPercent]));
    const projected = existing.map((d) => weightById.get(d.id) ?? Number(d.weightPercent));
    const { ok, sum } = roleKpiWeightsSumOk(projected);
    if (!ok) {
      throw new ApiError(
        `KPI weights for this role must sum to 100% (would be ${sum.toFixed(2)}%)`,
        400,
      );
    }

    const changed = body.weights.filter((row) => {
      const before = existingById.get(row.id)!;
      return Number(before.weightPercent) !== row.weightPercent;
    });

    const updated = await prisma.$transaction(
      changed.map((row) =>
        prisma.employeeKpiDefinition.update({
          where: { id: row.id },
          data: { weightPercent: row.weightPercent },
        }),
      ),
    );

    for (const after of updated) {
      const before = existingById.get(after.id)!;
      await writeAuditLogDirect({
        entityType: "EmployeeKpiDefinition",
        entityId: String(after.id),
        action: "UPDATE",
        userId: ctx.employeeId,
        correlationId: ctx.correlationId,
        before,
        after,
      });
    }

    return jsonOk(
      { roleId: body.roleId, updatedCount: updated.length, updated },
      ctx.correlationId,
    );
  });
}
