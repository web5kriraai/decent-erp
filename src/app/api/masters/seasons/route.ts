import { prisma } from "@/lib/db";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";

export async function GET() {
  return withApiHandler(null, async (ctx) => {
    const seasons = await prisma.season.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return jsonOk(serializeBigInt(seasons), ctx.correlationId);
  });
}
