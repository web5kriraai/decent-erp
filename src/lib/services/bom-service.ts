import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors/api-error";
import { assertSameCompany } from "@/lib/tenant";

export async function listBomLines(designId: bigint, companyId: number) {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: { companyId: true },
  });
  if (!design) throw new ApiError("Design not found", 404);
  assertSameCompany(design.companyId, { companyId }, "Design");

  return prisma.designBomLine.findMany({
    where: { designId, active: true },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    include: {
      catalogItem: { select: { id: true, code: true, name: true, masterType: true } },
      children: {
        where: { active: true },
        orderBy: { sequence: "asc" },
        select: { id: true, itemName: true, quantity: true, unit: true },
      },
    },
  });
}

export async function createBomLine(
  designId: bigint,
  companyId: number,
  input: {
    parentLineId?: string | null;
    sequence?: number;
    itemCode?: string;
    itemName: string;
    catalogItemId?: number | null;
    quantity: number;
    unit?: string;
    wastePercent?: number | null;
    estimatedUnitCost?: number | null;
    notes?: string | null;
  },
) {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: { companyId: true },
  });
  if (!design) throw new ApiError("Design not found", 404);
  assertSameCompany(design.companyId, { companyId }, "Design");

  if (input.parentLineId) {
    const parent = await prisma.designBomLine.findFirst({
      where: { id: BigInt(input.parentLineId), designId },
    });
    if (!parent) throw new ApiError("Parent BOM line not found on this design", 400);
  }

  return prisma.designBomLine.create({
    data: {
      designId,
      parentLineId: input.parentLineId ? BigInt(input.parentLineId) : null,
      sequence: input.sequence ?? 1,
      itemCode: input.itemCode?.trim() || null,
      itemName: input.itemName.trim(),
      catalogItemId: input.catalogItemId ?? null,
      quantity: input.quantity,
      unit: input.unit?.trim() || "pcs",
      wastePercent: input.wastePercent ?? null,
      estimatedUnitCost: input.estimatedUnitCost ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateBomLine(
  lineId: bigint,
  companyId: number,
  input: {
    itemName?: string;
    itemCode?: string | null;
    quantity?: number;
    unit?: string;
    wastePercent?: number | null;
    estimatedUnitCost?: number | null;
    notes?: string | null;
    active?: boolean;
    sequence?: number;
  },
) {
  const line = await prisma.designBomLine.findUnique({
    where: { id: lineId },
    include: { design: { select: { companyId: true } } },
  });
  if (!line) throw new ApiError("BOM line not found", 404);
  assertSameCompany(line.design.companyId, { companyId }, "Design");

  return prisma.designBomLine.update({
    where: { id: lineId },
    data: {
      ...(input.itemName != null ? { itemName: input.itemName.trim() } : {}),
      ...(input.itemCode !== undefined ? { itemCode: input.itemCode?.trim() || null } : {}),
      ...(input.quantity != null ? { quantity: input.quantity } : {}),
      ...(input.unit != null ? { unit: input.unit.trim() } : {}),
      ...(input.wastePercent !== undefined ? { wastePercent: input.wastePercent } : {}),
      ...(input.estimatedUnitCost !== undefined
        ? { estimatedUnitCost: input.estimatedUnitCost }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.active != null ? { active: input.active } : {}),
      ...(input.sequence != null ? { sequence: input.sequence } : {}),
    },
  });
}

export async function bomRollupCost(designId: bigint, companyId: number) {
  const lines = await listBomLines(designId, companyId);
  let estimated = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    const waste = Number(line.wastePercent ?? 0) / 100;
    const unitCost = Number(line.estimatedUnitCost ?? 0);
    estimated += qty * (1 + waste) * unitCost;
  }
  return { lineCount: lines.length, estimatedTotal: Math.round(estimated * 100) / 100 };
}
