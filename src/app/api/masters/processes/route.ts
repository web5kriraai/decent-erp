import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getProcessMasters } from "@/lib/services/kpi-service";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const processes = await getProcessMasters();
    return jsonOk(serializeBigInt(processes), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const process = await prisma.designProcessMaster.create({ data: body });
    await writeAuditLogDirect({
      entityType: "DesignProcessMaster",
      entityId: String(process.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: process,
    });
    return jsonOk(serializeBigInt(process), ctx.correlationId, 201);
  });
}
