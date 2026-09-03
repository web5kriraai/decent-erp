import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import {
  businessRule,
  createAppError,
  notFound,
} from "@/lib/errors/create-app-error";
import { canRoleMarkDesignLive } from "@/lib/action-availability";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";
import {
  buildProductionDeskLadderSnapshot,
  PRODUCTION_DESK_LADDER_CODES,
} from "@/lib/services/production-desk-snapshot";
import {
  validateProductionReleaseReadiness,
} from "@/lib/services/production-release-readiness";
import { formatProductionReleaseMissing } from "@/lib/services/production-workflow";
import { findStageApprovalGate } from "@/lib/services/workflow-stage-gate";

export async function listApprovedDesigns() {
  const designs = await prisma.designConcept.findMany({
    where: { status: { in: ["APPROVED", "PRODUCTION_ACCEPTED"] } },
    orderBy: { updatedAtUtc: "desc" },
    include: {
      productType: { select: { name: true } },
      season: { select: { name: true } },
      designHead: { select: { id: true, name: true } },
      costs: true,
      productionHandoffs: { take: 3, orderBy: { releasedAtUtc: "desc" } },
      tasks: {
        where: {
          subProcess: { code: { in: [...PRODUCTION_DESK_LADDER_CODES] } },
        },
        select: {
          id: true,
          status: true,
          assignedEmployeeId: true,
          subProcess: { select: { code: true } },
          assignedEmployee: { select: { name: true } },
        },
      },
    },
  });

  return Promise.all(
    designs.map(async (design) => {
      const readiness = await validateProductionReleaseReadiness(design.id);
      const ladder = buildProductionDeskLadderSnapshot(design.tasks);
      const { tasks: _tasks, ...rest } = design;
      return {
        ...rest,
        releaseReady: readiness.ok,
        releaseMissing: readiness.missing,
        ladderStages: ladder.stages,
        nextAction: ladder.nextAction,
      };
    }),
  );
}

export async function listReleasedDesignsForGoLive() {
  const designs = await prisma.designConcept.findMany({
    where: { status: "PRODUCTION_RELEASED" },
    orderBy: { updatedAtUtc: "desc" },
    include: {
      productType: { select: { name: true } },
      designHead: { select: { id: true, name: true } },
      tasks: {
        where: { subProcess: { code: "LIVE_REVIEW" } },
        select: { id: true, status: true },
        take: 1,
      },
    },
    take: 100,
  });

  return designs.map((design) => {
    const liveReview = design.tasks[0];
    const liveReviewCompleted = !liveReview || liveReview.status === "COMPLETED";
    return {
      id: design.id,
      ideaRef: design.ideaRef,
      collectionName: design.collectionName,
      status: design.status,
      productType: design.productType,
      designHead: design.designHead,
      liveReviewCompleted,
      liveReviewStatus: liveReview?.status ?? null,
      liveReviewTaskId: liveReview?.id?.toString() ?? null,
    };
  });
}

export async function releaseToProduction(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  const existing = await prisma.designConcept.findUnique({
    where: { id: designId },
    include: {
      productType: { select: { name: true } },
      season: { select: { name: true } },
    },
  });
  if (!existing) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
  // Idempotent: already released / live — no duplicate handoffs or notify.
  if (existing.status === "PRODUCTION_RELEASED" || existing.status === "LIVE") {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const readiness = await validateProductionReleaseReadiness(designId, tx);
    if (!readiness.ok) {
      throw businessRule(
        APP_ERROR_CODES.PRODUCTION_RELEASE_BLOCKED,
        readiness.missing,
        formatProductionReleaseMissing(readiness.missing),
      );
    }

    const design = await tx.designConcept.findUnique({
      where: { id: designId },
      include: {
        productType: { select: { name: true } },
        season: { select: { name: true } },
      },
    });
    if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);

    if (design.status === "PRODUCTION_RELEASED" || design.status === "LIVE") {
      return { design, newlyReleased: false as const };
    }

    // Heal: management chain finished but design still APPROVAL_PENDING (bypass / race).
    if (design.status === "APPROVAL_PENDING") {
      const levels = await tx.approvalLevel.findMany({
        where: { active: true },
        select: { id: true },
      });
      if (levels.length > 0) {
        const approvals = await tx.designApproval.findMany({
          where: { designId, decision: { in: ["APPROVED", "SKIPPED"] } },
          select: { approvalLevelId: true },
        });
        const passed = new Set(approvals.map((a) => a.approvalLevelId));
        if (levels.every((l) => passed.has(l.id))) {
          await tx.designConcept.update({
            where: { id: designId },
            data: { status: "APPROVED" },
          });
          design.status = "APPROVED";
        }
      }
    }

    if (design.status !== "APPROVED" && design.status !== "PRODUCTION_ACCEPTED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "Only accepted production designs can be released. Complete management approval first.",
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

    const handoffPayload = {
      contractVersion: 1,
      sourceModule: "DESIGN_MANAGEMENT",
      designId: designId.toString(),
      ideaRef: design.ideaRef,
      collectionName: design.collectionName,
      productTypeId: design.productTypeId,
      productTypeName: design.productType?.name ?? null,
      seasonId: design.seasonId,
      seasonName: design.season?.name ?? null,
    };

    for (const erpModule of ERP_HANDOFF_MODULES) {
      await tx.productionHandoff.create({
        data: {
          designId,
          designNumber,
          erpModule,
          status: "QUEUED",
          releasedById: actorId,
          payload: handoffPayload,
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

    return { design: updated, newlyReleased: true as const };
  }).then(async (result) => {
    if (!result.newlyReleased) return result.design;
    const design = result.design;
    await enqueueOutboxAndNotify(
      "PRODUCTION_RELEASED",
      { designId: design.id.toString(), ideaRef: design.ideaRef, designNumber: design.designNumber },
      correlationId,
    );
    const { syncAllErpModules } = await import("@/lib/services/erp-handoff-service");
    const { seedErpStagesForDesign } = await import("@/lib/services/erp-stage-service");
    if (design.designNumber) {
      await seedErpStagesForDesign(design.id, design.designNumber, actorId, correlationId);
    }
    await syncAllErpModules(design.id, actorId, correlationId);
    return design;
  });
}

/**
 * PROD_RELEASE was incorrectly forced to CHECKING by LIVE_REVIEW acting as a gate.
 * Promote orphan CHECKING → COMPLETED and trigger ERP release when ready.
 */
export async function healStuckProdReleaseChecking(
  designId: bigint,
  actorId: number,
  correlationId: string,
): Promise<{ healedTask: boolean; released: boolean }> {
  const siblings = await prisma.designTask.findMany({
    where: { designId },
    select: {
      id: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      assignedEmployeeId: true,
      subProcess: { select: { name: true, code: true, isApproval: true } },
      assignedEmployee: { select: { name: true } },
    },
    orderBy: { sequence: "asc" },
  });

  const prodRelease = siblings.find((t) => t.subProcess.code === "PROD_RELEASE");
  if (!prodRelease || prodRelease.status !== "CHECKING") {
    return { healedTask: false, released: false };
  }

  const stageSiblings = siblings.map((s) => ({
    id: s.id.toString(),
    dependencySequence: s.dependencySequence,
    sequence: s.sequence,
    status: s.status,
    assignedEmployeeId: s.assignedEmployeeId,
    subProcess: s.subProcess,
    assignedEmployee: s.assignedEmployee,
  }));

  const gate = findStageApprovalGate(
    {
      id: prodRelease.id.toString(),
      dependencySequence: prodRelease.dependencySequence,
      sequence: prodRelease.sequence,
      subProcess: { isApproval: false, code: "PROD_RELEASE" },
    },
    stageSiblings,
  );

  // Real stage-approval gate still open → leave CHECKING.
  if (gate) {
    return { healedTask: false, released: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.designTask.update({
      where: { id: prodRelease.id },
      data: { status: "COMPLETED", version: { increment: 1 } },
    });
    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: prodRelease.id.toString(),
      action: "HEAL_PROD_RELEASE_CHECKING",
      userId: actorId,
      correlationId,
      before: { status: "CHECKING" },
      after: { status: "COMPLETED" },
    });
    const { unlockNextDependentTasks } = await import(
      "@/lib/services/task-dependency-unlock"
    );
    await unlockNextDependentTasks(
      tx,
      {
        id: prodRelease.id,
        designId,
        dependencySequence: prodRelease.dependencySequence,
        sequence: prodRelease.sequence,
        subProcessCode: "PROD_RELEASE",
      },
      correlationId,
    );
  });

  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: { status: true },
  });

  if (
    design &&
    (design.status === "APPROVED" ||
      design.status === "PRODUCTION_ACCEPTED" ||
      design.status === "APPROVAL_PENDING")
  ) {
    try {
      await releaseToProduction(designId, actorId, `${correlationId}-heal-release`);
      return { healedTask: true, released: true };
    } catch {
      // Readiness / status may still block; task is at least COMPLETED for LIVE_REVIEW.
      return { healedTask: true, released: false };
    }
  }

  return { healedTask: true, released: false };
}

export async function markDesignLive(designId: bigint, actorId: number, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const actor = await tx.employee.findUnique({
      where: { id: actorId },
      select: { role: { select: { code: true } } },
    });
    if (!canRoleMarkDesignLive(actor?.role?.code)) {
      throw createAppError(
        APP_ERROR_CODES.PERMISSION_DENIED,
        403,
        undefined,
        "Only Management can mark a design live.",
      );
    }

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
