import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const items = await prisma.qualityChecklistItem.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      include: { subProcess: { select: { id: true, code: true, name: true } } },
    });
    return jsonOk(items, ctx.correlationId);
  });
}
