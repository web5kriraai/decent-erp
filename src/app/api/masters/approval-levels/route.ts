import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getApprovalLevels } from "@/lib/services/approval-service";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const levels = await getApprovalLevels();
    return jsonOk(levels, ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const level = await prisma.approvalLevel.create({
      data: { code: body.code.toUpperCase(), name: body.name, sequence: body.sequence },
    });
    await writeAuditLogDirect({
      entityType: "ApprovalLevel",
      entityId: String(level.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: level,
    });
    return jsonOk(level, ctx.correlationId, 201);
  });
}
