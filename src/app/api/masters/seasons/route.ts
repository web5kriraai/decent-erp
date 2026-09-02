import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const includeInactive =
      ctx.permissions.includes(PERMISSIONS.MASTER_ADMIN) &&
      new URL(request.url).searchParams.get("includeInactive") === "1";
    const seasons = await prisma.season.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: "asc" },
    });
    return jsonOk(serializeBigInt(seasons), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const created = await prisma.season.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name.trim(),
        active: true,
      },
    });
    await writeAuditLogDirect({
      entityType: "Season",
      entityId: String(created.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: created,
    });
    return jsonOk(serializeBigInt(created), ctx.correlationId, 201);
  });
}
