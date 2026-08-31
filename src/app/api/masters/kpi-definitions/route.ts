import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getKpiDefinitions } from "@/lib/services/kpi-service";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  roleId: z.number().int().positive(),
  metricCode: z.string().min(1),
  weightPercent: z.number().positive().max(100),
  target: z.number().optional(),
});

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const roleId = new URL(request.url).searchParams.get("roleId");
    const defs = await getKpiDefinitions(roleId ? Number(roleId) : undefined);
    return jsonOk(defs, ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const def = await prisma.employeeKpiDefinition.create({
      data: {
        ...body,
        effectiveFrom: new Date(),
      },
    });
    return jsonOk(def, ctx.correlationId, 201);
  });
}
