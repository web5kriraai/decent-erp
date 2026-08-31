import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const types = await prisma.componentType.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    return jsonOk(types, ctx.correlationId);
  });
}
