import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultRoleId: z.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const includeInactive =
      new URL(request.url).searchParams.get("includeInactive") === "1";
    const skills = await prisma.skill.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        defaultRoleId: true,
        active: true,
      },
    });
    return jsonOk(serializeBigInt(skills), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const skill = await prisma.skill.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        defaultRoleId: body.defaultRoleId ?? null,
      },
    });
    await writeAuditLogDirect({
      entityType: "Skill",
      entityId: String(skill.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: skill,
    });
    return jsonOk(serializeBigInt(skill), ctx.correlationId, 201);
  });
}
