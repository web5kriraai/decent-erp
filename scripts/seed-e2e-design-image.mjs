/**
 * Inserts a DesignImage row so file-required task end can succeed without MinIO.
 * Usage: npx tsx scripts/seed-e2e-design-image.mjs <designId> [uploadedByEmployeeId]
 */
import { PrismaClient } from "@prisma/client";

const designId = process.argv[2];
const uploadedByArg = process.argv[3];

if (!designId) {
  console.error("Usage: seed-e2e-design-image.mjs <designId> [uploadedByEmployeeId]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  let uploadedById = uploadedByArg ? Number(uploadedByArg) : NaN;
  if (!Number.isFinite(uploadedById)) {
    const sketch = await prisma.employee.findUnique({
      where: { email: "sketch@decent-erp.local" },
      select: { id: true },
    });
    uploadedById = sketch?.id ?? 1;
  }

  await prisma.designImage.create({
    data: {
      designId: BigInt(designId),
      storageKey: `e2e/${designId}/placeholder-${Date.now()}.png`,
      fileName: "e2e-placeholder.png",
      contentType: "image/png",
      fileSize: BigInt(68),
      isPrimary: false,
      uploadedById,
    },
  });
  console.log(`[seed-e2e-design-image] Seeded image for design ${designId}`);
} finally {
  await prisma.$disconnect();
}
