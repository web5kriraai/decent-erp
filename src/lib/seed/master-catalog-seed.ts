import type { PrismaClient } from "@prisma/client";
import { MASTER_TYPES, type MasterType } from "@/lib/master-catalog-types";

type CatalogSeedRow = {
  masterType: MasterType;
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
};

export async function upsertMasterCatalogRow(
  prisma: PrismaClient,
  row: CatalogSeedRow,
) {
  return prisma.masterCatalog.upsert({
    where: {
      masterType_code: { masterType: row.masterType, code: row.code },
    },
    update: {
      name: row.name,
      description: row.description ?? null,
      isActive: true,
      sortOrder: row.sortOrder ?? 0,
    },
    create: {
      masterType: row.masterType,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: true,
    },
  });
}

export async function seedMasterCatalogBatch(
  prisma: PrismaClient,
  rows: readonly CatalogSeedRow[],
  label: string,
) {
  const total = rows.length;
  for (let i = 0; i < total; i++) {
    await upsertMasterCatalogRow(prisma, rows[i]);
    if (total > 8 && (i + 1) % 5 === 0) {
      const pct = Math.round(((i + 1) / total) * 100);
      process.stdout.write(`\r  seeding ${label}: ${pct}% (${i + 1}/${total})`);
    }
  }
  if (total > 8) process.stdout.write(`\r  seeding ${label}: 100% (${total}/${total})\n`);
}

export const PRODUCT_CATEGORY_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.PRODUCT_CATEGORY, code: "SAREE", name: "Saree", sortOrder: 1 },
  { masterType: MASTER_TYPES.PRODUCT_CATEGORY, code: "SUIT", name: "Suit", sortOrder: 2 },
  { masterType: MASTER_TYPES.PRODUCT_CATEGORY, code: "KURTI", name: "Kurti", sortOrder: 3 },
  { masterType: MASTER_TYPES.PRODUCT_CATEGORY, code: "LEHENGA", name: "Lehenga", sortOrder: 4 },
];

export const SEASON_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.SEASON, code: "SS26", name: "Spring Summer 2026", sortOrder: 1 },
  { masterType: MASTER_TYPES.SEASON, code: "AW26", name: "Autumn Winter 2026", sortOrder: 2 },
  { masterType: MASTER_TYPES.SEASON, code: "FEST26", name: "Festive 2026", sortOrder: 3 },
  { masterType: MASTER_TYPES.SEASON, code: "WEDDING", name: "Wedding", sortOrder: 4 },
  { masterType: MASTER_TYPES.SEASON, code: "SUMMER", name: "Summer", sortOrder: 5 },
  { masterType: MASTER_TYPES.SEASON, code: "PREMIUM", name: "Premium", sortOrder: 6 },
];

export const COMPONENT_CATALOG_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "BODY", name: "Body", sortOrder: 1 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "PALLU", name: "Pallu", sortOrder: 2 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "BORDER", name: "Border", sortOrder: 3 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "BLOUSE", name: "Blouse", sortOrder: 4 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "BUTTA", name: "Butta", sortOrder: 5 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "SLEEVE", name: "Sleeve", sortOrder: 6 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "TOP_FRONT", name: "Top Front", sortOrder: 7 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "TOP_BACK", name: "Top Back", sortOrder: 8 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "BOTTOM", name: "Bottom", sortOrder: 9 },
  { masterType: MASTER_TYPES.PRODUCT_COMPONENT, code: "DUPATTA", name: "Dupatta", sortOrder: 10 },
];

export const FABRIC_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.FABRIC_QUALITY, code: "SILK", name: "Silk", sortOrder: 1 },
  { masterType: MASTER_TYPES.FABRIC_QUALITY, code: "COTTON", name: "Cotton", sortOrder: 2 },
  { masterType: MASTER_TYPES.FABRIC_QUALITY, code: "GEORGETTE", name: "Georgette", sortOrder: 3 },
  { masterType: MASTER_TYPES.FABRIC_QUALITY, code: "CHIFFON", name: "Chiffon", sortOrder: 4 },
  { masterType: MASTER_TYPES.FABRIC_QUALITY, code: "VELVET", name: "Velvet", sortOrder: 5 },
];

export const MACHINE_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.MACHINE, code: "TAJIMA_MULTI", name: "Tajima Multi-head", sortOrder: 1 },
  { masterType: MASTER_TYPES.MACHINE, code: "BARUDAN", name: "Barudan", sortOrder: 2 },
  { masterType: MASTER_TYPES.MACHINE, code: "M02", name: "Machine M-02", sortOrder: 3 },
  { masterType: MASTER_TYPES.MACHINE, code: "M03", name: "Machine M-03", sortOrder: 4 },
  { masterType: MASTER_TYPES.MACHINE, code: "M04", name: "Machine M-04", sortOrder: 5 },
];

export const STITCHING_TYPE_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.STITCHING_TYPE, code: "LOCKSTITCH", name: "Lockstitch", sortOrder: 1 },
  { masterType: MASTER_TYPES.STITCHING_TYPE, code: "CHAIN_STITCH", name: "Chain stitch", sortOrder: 2 },
];

export const DESIGN_GRADE_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.DESIGN_GRADE, code: "A", name: "Grade A", sortOrder: 1 },
  { masterType: MASTER_TYPES.DESIGN_GRADE, code: "B", name: "Grade B", sortOrder: 2 },
  { masterType: MASTER_TYPES.DESIGN_GRADE, code: "C", name: "Grade C", sortOrder: 3 },
  { masterType: MASTER_TYPES.DESIGN_GRADE, code: "L3", name: "Complexity Level 3", sortOrder: 4 },
  { masterType: MASTER_TYPES.DESIGN_GRADE, code: "L4", name: "Complexity Level 4", sortOrder: 5 },
];

export const CORRECTION_TYPE_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "MISTAKE", name: "Mistake", sortOrder: 1 },
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "IMPROVEMENT", name: "Management Improvement", sortOrder: 2 },
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "CUSTOMER_CHANGE", name: "Customer Change", sortOrder: 3 },
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "MACHINE", name: "Machine Issue", sortOrder: 4 },
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "MATERIAL", name: "Material Issue", sortOrder: 5 },
  { masterType: MASTER_TYPES.CORRECTION_TYPE, code: "OTHER", name: "Other", sortOrder: 6 },
];

const EXTRA_CATALOG_SEED: CatalogSeedRow[] = [
  { masterType: MASTER_TYPES.FESTIVAL, code: "DIWALI", name: "Diwali", sortOrder: 1 },
  { masterType: MASTER_TYPES.FESTIVAL, code: "EID", name: "Eid", sortOrder: 2 },
  { masterType: MASTER_TYPES.FESTIVAL, code: "WEDDING_SEASON", name: "Wedding Season", sortOrder: 3 },
  { masterType: MASTER_TYPES.STYLE, code: "TRADITIONAL", name: "Traditional", sortOrder: 1 },
  { masterType: MASTER_TYPES.STYLE, code: "CONTEMPORARY", name: "Contemporary", sortOrder: 2 },
  { masterType: MASTER_TYPES.STYLE, code: "FUSION", name: "Fusion", sortOrder: 3 },
  { masterType: MASTER_TYPES.THEME, code: "FLORAL", name: "Floral", sortOrder: 1 },
  { masterType: MASTER_TYPES.THEME, code: "GEOMETRIC", name: "Geometric", sortOrder: 2 },
  { masterType: MASTER_TYPES.THEME, code: "HERITAGE", name: "Heritage", sortOrder: 3 },
  { masterType: MASTER_TYPES.CELEBRITY, code: "NONE", name: "None", sortOrder: 1 },
  { masterType: MASTER_TYPES.CELEBRITY, code: "TREND_REF", name: "Trend Reference", sortOrder: 2 },
  { masterType: MASTER_TYPES.WORK_TYPE, code: "NEW_DESIGN", name: "New Design", sortOrder: 1 },
  { masterType: MASTER_TYPES.WORK_TYPE, code: "REPEAT", name: "Repeat", sortOrder: 2 },
  { masterType: MASTER_TYPES.WORK_TYPE, code: "REVIVAL", name: "Revival", sortOrder: 3 },
  { masterType: MASTER_TYPES.WORK_TYPE, code: "CUSTOM", name: "Custom", sortOrder: 4 },
  { masterType: MASTER_TYPES.COLOUR_TONE, code: "GOLD", name: "Gold", sortOrder: 1 },
  { masterType: MASTER_TYPES.COLOUR_TONE, code: "MAROON", name: "Maroon", sortOrder: 2 },
  { masterType: MASTER_TYPES.COLOUR_TONE, code: "IVORY", name: "Ivory", sortOrder: 3 },
  { masterType: MASTER_TYPES.COLOUR_TONE, code: "EMERALD", name: "Emerald", sortOrder: 4 },
  { masterType: MASTER_TYPES.THREAD, code: "ZARI", name: "Zari", sortOrder: 1 },
  { masterType: MASTER_TYPES.THREAD, code: "POLYESTER", name: "Polyester", sortOrder: 2 },
  { masterType: MASTER_TYPES.THREAD, code: "RAYON", name: "Rayon", sortOrder: 3 },
  { masterType: MASTER_TYPES.ACCESSORIES, code: "SEQUIN", name: "Sequin", sortOrder: 1 },
  { masterType: MASTER_TYPES.ACCESSORIES, code: "BEAD", name: "Bead", sortOrder: 2 },
  { masterType: MASTER_TYPES.ACCESSORIES, code: "MIRROR", name: "Mirror", sortOrder: 3 },
  { masterType: MASTER_TYPES.SOFTWARE, code: "WILCOM", name: "Wilcom", sortOrder: 1 },
  { masterType: MASTER_TYPES.SOFTWARE, code: "PULSE", name: "Pulse", sortOrder: 2 },
  { masterType: MASTER_TYPES.COMPLEXITY_LEVEL, code: "L1", name: "Level 1", sortOrder: 1 },
  { masterType: MASTER_TYPES.COMPLEXITY_LEVEL, code: "L2", name: "Level 2", sortOrder: 2 },
  { masterType: MASTER_TYPES.COMPLEXITY_LEVEL, code: "L3", name: "Level 3", sortOrder: 3 },
  { masterType: MASTER_TYPES.COMPLEXITY_LEVEL, code: "L4", name: "Level 4", sortOrder: 4 },
  { masterType: MASTER_TYPES.DESIGN_PATTERN, code: "PREMIUM", name: "Premium Embroidery", sortOrder: 1 },
  { masterType: MASTER_TYPES.DESIGN_PATTERN, code: "STANDARD", name: "Standard Design", sortOrder: 2 },
  { masterType: MASTER_TYPES.DESIGN_PATTERN, code: "FAST", name: "Fast Commercial", sortOrder: 3 },
  { masterType: MASTER_TYPES.MISTAKE_CATEGORY, code: "SKETCH", name: "Sketch Mistake", sortOrder: 1 },
  { masterType: MASTER_TYPES.MISTAKE_CATEGORY, code: "PUNCH", name: "Punching Mistake", sortOrder: 2 },
  { masterType: MASTER_TYPES.MISTAKE_CATEGORY, code: "SAMPLE", name: "Sample Mistake", sortOrder: 3 },
  { masterType: MASTER_TYPES.PHYSICAL_SAMPLE_LOCATION, code: "STORE_A", name: "Store A", sortOrder: 1 },
  { masterType: MASTER_TYPES.PHYSICAL_SAMPLE_LOCATION, code: "STORE_B", name: "Store B", sortOrder: 2 },
  { masterType: MASTER_TYPES.PHYSICAL_SAMPLE_LOCATION, code: "SHOWROOM", name: "Showroom", sortOrder: 3 },
];

/** @deprecated use COMPONENT_CATALOG_SEED — kept name for import compatibility */
export const COMPONENT_TYPE_SEED = [
  { code: "BODY", name: "Body", sequence: 1 },
  { code: "PALLU", name: "Pallu", sequence: 2 },
  { code: "BORDER", name: "Border", sequence: 3 },
  { code: "BLOUSE", name: "Blouse", sequence: 4 },
  { code: "SLEEVE", name: "Sleeve", sequence: 5 },
  { code: "TOP_FRONT", name: "Top Front", sequence: 6 },
  { code: "TOP_BACK", name: "Top Back", sequence: 7 },
  { code: "BOTTOM", name: "Bottom", sequence: 8 },
  { code: "DUPATTA", name: "Dupatta", sequence: 9 },
] as const;

export async function seedAllMasterCatalog(prisma: PrismaClient) {
  const batches: Array<{ label: string; rows: CatalogSeedRow[] }> = [
    { label: "product categories", rows: PRODUCT_CATEGORY_SEED },
    { label: "seasons", rows: SEASON_SEED },
    { label: "components", rows: COMPONENT_CATALOG_SEED },
    { label: "fabrics", rows: FABRIC_SEED },
    { label: "machines", rows: MACHINE_SEED },
    { label: "stitching", rows: STITCHING_TYPE_SEED },
    { label: "grades", rows: DESIGN_GRADE_SEED },
    { label: "corrections", rows: CORRECTION_TYPE_SEED },
    { label: "extra masters", rows: EXTRA_CATALOG_SEED },
  ];
  for (const batch of batches) {
    await seedMasterCatalogBatch(prisma, batch.rows, batch.label);
  }
}

export async function seedComponentTypes(prisma: PrismaClient) {
  await seedMasterCatalogBatch(prisma, COMPONENT_CATALOG_SEED, "components");
}

export async function seedRdCatalogMasters(prisma: PrismaClient) {
  await seedMasterCatalogBatch(prisma, [
    ...FABRIC_SEED,
    ...MACHINE_SEED,
    ...STITCHING_TYPE_SEED,
    ...DESIGN_GRADE_SEED,
    ...CORRECTION_TYPE_SEED,
  ], "rd catalogs");
}
