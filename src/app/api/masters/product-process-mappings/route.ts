import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";

const createSchema = z.object({
  productTypeId: z.number().int().positive(),
  processId: z.number().int().positive(),
  required: z.boolean().optional(),
});

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

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const productType = await prisma.productType.findUnique({ where: { id: body.productTypeId } });
    if (!productType) throw new ApiError("Product type not found", 404);
    const process = await prisma.designProcessMaster.findUnique({ where: { id: body.processId } });
    if (!process) throw new ApiError("Process not found", 404);

    const created = await prisma.productProcessMapping.create({
      data: {
        productTypeId: body.productTypeId,
        processId: body.processId,
        required: body.required ?? true,
      },
      include: {
        process: { select: { id: true, code: true, name: true } },
        productType: { select: { id: true, code: true, name: true } },
      },
    });

    await writeAuditLogDirect({
      entityType: "ProductProcessMapping",
      entityId: String(created.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: created,
    });

    return jsonOk(serializeBigInt(created), ctx.correlationId, 201);
  });
}
