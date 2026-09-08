/**
 * Prisma where for marking design images REJECTED on sample/correction/approval return.
 * Must include the primary image — a design with only a primary would otherwise get zero REJECTED rows.
 */
export function designImagesRejectWhere(designId: number | bigint) {
  return { designId };
}
