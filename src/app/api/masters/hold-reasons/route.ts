import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  excludeFromActiveTime: z.boolean().optional(),
});

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const reasons = await prisma.taskHoldReason.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
    return jsonOk(serializeBigInt(reasons), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const reason = await prisma.taskHoldReason.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        excludeFromActiveTime: body.excludeFromActiveTime ?? false,
      },
    });
    await writeAuditLogDirect({
      entityType: "TaskHoldReason",
      entityId: String(reason.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: reason,
    });
    return jsonOk(serializeBigInt(reason), ctx.correlationId, 201);
  });
}
