import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import {
  businessRule,
  createAppError,
  notFound,
} from "@/lib/errors/create-app-error";
import { designHasCosting } from "@/lib/services/costing-service";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";
import {
  validateProductionReleaseReadiness,
} from "@/lib/services/production-release-readiness";
import { formatProductionReleaseMissing } from "@/lib/services/production-workflow";

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
  const readiness = await validateProductionReleaseReadiness(designId);
  if (!readiness.ok) {
    throw businessRule(
      APP_ERROR_CODES.PRODUCTION_RELEASE_BLOCKED,
      readiness.missing,
      formatProductionReleaseMissing(readiness.missing),
    );
  }

  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
    if (design.status !== "APPROVED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "Only approved designs can be released to production. Complete the production workflow tasks first.",
      );
    }

    const prodRelease = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_RELEASE" } },
    });
    if (prodRelease && prodRelease.status !== "COMPLETED") {
      throw businessRule(APP_ERROR_CODES.PRODUCTION_RELEASE_TASK_REQUIRED);
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
    if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
    if (design.status !== "PRODUCTION_RELEASED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "Only production-released designs can be marked live.",
      );
    }

    const liveReview = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "LIVE_REVIEW" } },
    });
    if (liveReview && liveReview.status !== "COMPLETED") {
      throw businessRule(
        APP_ERROR_CODES.WORKFLOW_NOT_READY,
        undefined,
        "Management live design review must be completed before marking live.",
      );
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
