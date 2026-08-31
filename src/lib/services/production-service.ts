import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import { designHasCosting } from "@/lib/services/costing-service";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";

export async function listApprovedDesigns() {
  return prisma.designConcept.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAtUtc: "desc" },
    include: {
      productType: { select: { name: true } },
      season: { select: { name: true } },
      designHead: { select: { id: true, name: true } },
      costs: true,
      productionHandoffs: { take: 3, orderBy: { releasedAtUtc: "desc" } },
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

    const designNumber = design.designNumber ?? `DN-${design.ideaRef.replace(/^IDEA-/, "")}`;

    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: {
        status: "PRODUCTION_RELEASED",
        designNumber,
      },
    });

    for (const module of ERP_HANDOFF_MODULES) {
      await tx.productionHandoff.create({
        data: {
          designId,
          designNumber,
          erpModule: module,
          status: "QUEUED",
          releasedById: actorId,
          payload: {
            ideaRef: design.ideaRef,
            collectionName: design.collectionName,
            productTypeId: design.productTypeId,
          },
        },
      });
    }

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
      { designId: design.id.toString(), ideaRef: design.ideaRef, designNumber: design.designNumber },
      correlationId,
    );
    const { syncPrimaryErpModules } = await import("@/lib/services/erp-handoff-service");
    await syncPrimaryErpModules(design.id, actorId, correlationId);
    return design;
  });
}

export async function markDesignLive(designId: bigint, actorId: number, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);
    if (design.status !== "PRODUCTION_RELEASED") {
      throw new ApiError("Only production-released designs can go live", 422);
    }
    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: { status: "LIVE" },
    });
    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "LIVE",
      userId: actorId,
      correlationId,
      before: design,
      after: updated,
    });
    return updated;
  });
}

export async function upsertDesignSuccessMetric(
  designId: bigint,
  data: {
    periodYear: number;
    periodMonth: number;
    productionQty?: number;
    salesQty?: number;
    salesValue?: number;
    returnQty?: number;
    marginPercent?: number;
    repeatOrders?: number;
  },
) {
  return prisma.designSuccessMetric.upsert({
    where: {
      designId_periodYear_periodMonth: {
        designId,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
      },
    },
    update: data,
    create: { designId, ...data },
  });
}
