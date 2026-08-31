import { prisma } from "@/lib/db";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const url = new URL(request.url);
    const productTypeId = url.searchParams.get("productTypeId");
    const mappings = await prisma.productProcessMapping.findMany({
      where: productTypeId ? { productTypeId: Number(productTypeId) } : undefined,
      include: {
        process: { select: { id: true, code: true, name: true } },
        productType: { select: { id: true, code: true, name: true } },
      },
      orderBy: { id: "asc" },
    });
    return jsonOk(serializeBigInt(mappings), ctx.correlationId);
  });
}
