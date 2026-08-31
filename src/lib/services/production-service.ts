import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import { designHasCosting } from "@/lib/services/costing-service";

export async function listApprovedDesigns() {
  return prisma.designConcept.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAtUtc: "desc" },
    include: {
      productType: { select: { name: true } },
      season: { select: { name: true } },
      designHead: { select: { id: true, name: true } },
      costs: true,
    },
  });
}

export async function releaseToProduction(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);
    if (design.status !== "APPROVED") {
      throw new ApiError("Only approved designs can be released to production", 422);
    }

    const hasCosting = await designHasCosting(designId);
    if (!hasCosting) {
      throw new ApiError("Costing must be complete before production release", 422);
    }

    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: { status: "PRODUCTION_RELEASED" },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "PRODUCTION_RELEASED",
      userId: actorId,
      correlationId,
      before: design,
      after: updated,
    });

    return updated;
  }).then(async (design) => {
    await enqueueOutboxAndNotify(
      "PRODUCTION_RELEASED",
      { designId: design.id.toString(), ideaRef: design.ideaRef },
      correlationId,
    );
    return design;
  });
}
