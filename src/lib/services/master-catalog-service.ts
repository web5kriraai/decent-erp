import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { MASTER_TYPES, type MasterType } from "@/lib/master-catalog-types";

const MASTER_TYPE_SET = new Set<string>(Object.values(MASTER_TYPES));

export function assertMasterType(value: string): MasterType {
  if (!MASTER_TYPE_SET.has(value)) {
    throw new ApiError(`Invalid masterType: ${value}`, 400);
  }
  return value as MasterType;
}

export async function listMasterCatalog(opts: {
  masterType?: string;
  includeInactive?: boolean;
}) {
  const masterType = opts.masterType ? assertMasterType(opts.masterType) : undefined;
  return prisma.masterCatalog.findMany({
    where: {
      ...(masterType ? { masterType } : {}),
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ masterType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getMasterCatalogById(id: number) {
  const row = await prisma.masterCatalog.findUnique({ where: { id } });
  if (!row) throw new ApiError("Master catalog item not found", 404);
  return row;
}

export async function requireMasterOfType(id: number, masterType: MasterType) {
  const row = await getMasterCatalogById(id);
  if (row.masterType !== masterType) {
    throw new ApiError(`Expected master type ${masterType}, got ${row.masterType}`, 400);
  }
  if (!row.isActive) {
    throw new ApiError("Master catalog item is inactive", 400);
  }
  return row;
}

export async function createMasterCatalog(input: {
  masterType: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const masterType = assertMasterType(input.masterType);
  return prisma.masterCatalog.create({
    data: {
      masterType,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateMasterCatalog(
  id: number,
  input: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  await getMasterCatalogById(id);
  return prisma.masterCatalog.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

/** Shape compatible with legacy ProductType / Season API responses. */
export function toLegacyActiveShape(row: {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder?: number;
  description?: string | null;
  masterType?: string;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.isActive,
    isActive: row.isActive,
    sortOrder: row.sortOrder ?? 0,
    description: row.description ?? null,
    masterType: row.masterType,
  };
}
