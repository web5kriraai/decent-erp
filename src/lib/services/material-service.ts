import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import type { MaterialLineStatus, MaterialSource } from "@prisma/client";

export async function listMaterialLines(designId?: bigint) {
  return prisma.designMaterialLine.findMany({
    where: designId ? { designId } : undefined,
    include: {
      catalogItem: true,
      design: { select: { id: true, ideaRef: true, collectionName: true } },
      requestedBy: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAtUtc: "desc" },
  });
}

export async function createMaterialLine(input: {
  designId: bigint;
  catalogItemId: number;
  unit: string;
  quantity: number;
  source: MaterialSource;
  remark?: string;
  requestedById: number;
}) {
  const design = await prisma.designConcept.findUnique({ where: { id: input.designId } });
  if (!design) throw new ApiError("Design not found", 404);
  const item = await prisma.masterCatalog.findUnique({ where: { id: input.catalogItemId } });
  if (!item || !item.isActive) throw new ApiError("Catalog item not found", 404);

  return prisma.designMaterialLine.create({
    data: {
      designId: input.designId,
      catalogItemId: input.catalogItemId,
      unit: input.unit,
      quantity: input.quantity,
      source: input.source,
      status: input.source === "PURCHASE_INDENT" ? "INDENT" : "REQUESTED",
      remark: input.remark,
      requestedById: input.requestedById,
    },
    include: { catalogItem: true },
  });
}

export async function updateMaterialLineStatus(input: {
  id: bigint;
  status: MaterialLineStatus;
  wastageQty?: number;
  issuedById?: number;
}) {
  const existing = await prisma.designMaterialLine.findUnique({ where: { id: input.id } });
  if (!existing) throw new ApiError("Material line not found", 404);

  return prisma.designMaterialLine.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.wastageQty !== undefined ? { wastageQty: input.wastageQty } : {}),
      ...(input.status === "ISSUED"
        ? { issuedById: input.issuedById, issuedAtUtc: new Date() }
        : {}),
    },
    include: { catalogItem: true },
  });
}
