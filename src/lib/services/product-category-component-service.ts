import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { MASTER_TYPES } from "@/lib/master-catalog-types";
import { getMasterCatalogById } from "@/lib/services/master-catalog-service";

export async function listComponentMastersForProductCategory(opts: {
  productCategoryId: number;
  includeInactive?: boolean;
}) {
  const category = await getMasterCatalogById(opts.productCategoryId);
  if (category.masterType !== MASTER_TYPES.PRODUCT_CATEGORY) {
    throw new ApiError("Invalid product category", 400);
  }

  const links = await prisma.productCategoryComponentLink.findMany({
    where: { productCategoryId: opts.productCategoryId },
    orderBy: [{ sortOrder: "asc" }, { componentId: "asc" }],
    include: { component: true },
  });

  return links
    .map((link) => link.component)
    .filter((row) => opts.includeInactive || row.isActive);
}

export async function getComponentIdsForProductCategory(productCategoryId: number) {
  const category = await getMasterCatalogById(productCategoryId);
  if (category.masterType !== MASTER_TYPES.PRODUCT_CATEGORY) {
    throw new ApiError("Not a product category", 400);
  }
  const links = await prisma.productCategoryComponentLink.findMany({
    where: { productCategoryId },
    select: { componentId: true },
    orderBy: [{ sortOrder: "asc" }, { componentId: "asc" }],
  });
  return links.map((l) => l.componentId);
}

export async function listComponentSummariesByCategory(categoryIds: number[]) {
  const map = new Map<number, { componentIds: number[]; componentNames: string[] }>();
  if (!categoryIds.length) return map;

  const links = await prisma.productCategoryComponentLink.findMany({
    where: { productCategoryId: { in: categoryIds } },
    orderBy: [{ sortOrder: "asc" }, { componentId: "asc" }],
    include: { component: { select: { id: true, name: true, isActive: true } } },
  });

  for (const link of links) {
    const entry = map.get(link.productCategoryId) ?? {
      componentIds: [],
      componentNames: [],
    };
    entry.componentIds.push(link.componentId);
    if (link.component.isActive) entry.componentNames.push(link.component.name);
    map.set(link.productCategoryId, entry);
  }
  return map;
}

export async function setComponentsForProductCategory(
  productCategoryId: number,
  componentIds: number[],
) {
  const category = await getMasterCatalogById(productCategoryId);
  if (category.masterType !== MASTER_TYPES.PRODUCT_CATEGORY) {
    throw new ApiError("Not a product category", 400);
  }

  const uniqueIds = [...new Set(componentIds)];
  for (const componentId of uniqueIds) {
    const component = await getMasterCatalogById(componentId);
    if (component.masterType !== MASTER_TYPES.PRODUCT_COMPONENT) {
      throw new ApiError(`Invalid product component id ${componentId}`, 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategoryComponentLink.deleteMany({ where: { productCategoryId } });
    if (uniqueIds.length) {
      await tx.productCategoryComponentLink.createMany({
        data: uniqueIds.map((componentId, index) => ({
          productCategoryId,
          componentId,
          sortOrder: index,
        })),
      });
    }
  });

  return getComponentIdsForProductCategory(productCategoryId);
}

export async function getProductCategoryIdsForComponent(componentId: number) {
  const component = await getMasterCatalogById(componentId);
  if (component.masterType !== MASTER_TYPES.PRODUCT_COMPONENT) {
    throw new ApiError("Not a product component", 400);
  }
  const links = await prisma.productCategoryComponentLink.findMany({
    where: { componentId },
    select: { productCategoryId: true },
    orderBy: { productCategoryId: "asc" },
  });
  return links.map((l) => l.productCategoryId);
}

export async function setProductCategoriesForComponent(
  componentId: number,
  productCategoryIds: number[],
) {
  const component = await getMasterCatalogById(componentId);
  if (component.masterType !== MASTER_TYPES.PRODUCT_COMPONENT) {
    throw new ApiError("Not a product component", 400);
  }

  const uniqueIds = [...new Set(productCategoryIds)];
  for (const categoryId of uniqueIds) {
    const category = await getMasterCatalogById(categoryId);
    if (category.masterType !== MASTER_TYPES.PRODUCT_CATEGORY) {
      throw new ApiError(`Invalid product category id ${categoryId}`, 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategoryComponentLink.deleteMany({ where: { componentId } });
    if (uniqueIds.length) {
      await tx.productCategoryComponentLink.createMany({
        data: uniqueIds.map((productCategoryId, index) => ({
          productCategoryId,
          componentId,
          sortOrder: index,
        })),
      });
    }
  });

  return getProductCategoryIdsForComponent(componentId);
}

export async function assertComponentsAllowedForProductCategory(
  productCategoryId: number,
  componentTypeIds: number[],
) {
  if (!componentTypeIds.length) return;

  const allowed = await prisma.productCategoryComponentLink.findMany({
    where: {
      productCategoryId,
      componentId: { in: componentTypeIds },
    },
    select: { componentId: true },
  });
  const allowedSet = new Set(allowed.map((a) => a.componentId));
  const invalid = componentTypeIds.filter((id) => !allowedSet.has(id));
  if (invalid.length) {
    throw new ApiError(
      "One or more product components are not valid for the selected product type",
      422,
    );
  }
}
