import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
  subProcessId: z.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const includeInactive =
      new URL(request.url).searchParams.get("includeInactive") === "1";
    const items = await prisma.qualityChecklistItem.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { sequence: "asc" },
      include: { subProcess: { select: { id: true, code: true, name: true } } },
    });
    return jsonOk(items, ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const item = await prisma.qualityChecklistItem.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        sequence: body.sequence,
        subProcessId: body.subProcessId ?? null,
      },
      include: { subProcess: { select: { id: true, code: true, name: true } } },
    });
    await writeAuditLogDirect({
      entityType: "QualityChecklistItem",
      entityId: String(item.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: item,
    });
    return jsonOk(item, ctx.correlationId, 201);
  });
}
