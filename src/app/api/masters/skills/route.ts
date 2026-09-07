import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const skills = await prisma.skill.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        defaultRoleId: true,
      },
    });
    return jsonOk(serializeBigInt(skills), ctx.correlationId);
  });
}
