import { prisma } from "@/lib/db";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";

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
