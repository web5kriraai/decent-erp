import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import { ERP_HANDOFF_MODULES } from "@/lib/kpi-metrics";
import { upsertDesignSuccessMetric } from "@/lib/services/production-service";

export {
  ERP_STAGE_LABELS,
  ERP_STAGE_STATUSES,
  nextModuleAfter,
  type ErpStageStatus,
} from "@/lib/services/erp-stage-constants";

export type CompleteErpStageInput = {
  qty?: number;
  wastageQty?: number;
  amount?: number;
  lotRef?: string;
  invoiceRef?: string;
  remark?: string;
  marginPercent?: number;
};

function currentPeriod() {
  const now = new Date();
  return { periodYear: now.getUTCFullYear(), periodMonth: now.getUTCMonth() + 1 };
}

/** Seed 9 in-app ERP stages after production release (idempotent). */
export async function seedErpStagesForDesign(
  designId: bigint,
  designNumber: string,
  actorId: number,
  correlationId: string,
) {
  const existing = await prisma.erpStageRecord.count({ where: { designId } });
  if (existing > 0) {
    return prisma.erpStageRecord.findMany({
      where: { designId },
      orderBy: { sequence: "asc" },
    });
  }

  const rows = ERP_HANDOFF_MODULES.map((erpModule, index) => ({
    designId,
    designNumber,
    erpModule,
    sequence: index + 1,
    status: index === 0 ? "READY" : "PENDING",
  }));

  await prisma.erpStageRecord.createMany({ data: rows });

  const created = await prisma.erpStageRecord.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
  });

  await writeAuditLogDirect({
    entityType: "ErpStageRecord",
    entityId: designId.toString(),
    action: "ERP_STAGES_SEEDED",
    userId: actorId,
    correlationId,
    after: { designNumber, modules: created.map((r) => r.erpModule) },
  });

  return created;
}

export async function listErpStageChains(options?: {
  designId?: bigint;
  status?: string;
  take?: number;
}) {
  const stages = await prisma.erpStageRecord.findMany({
    where: {
      ...(options?.designId ? { designId: options.designId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: [{ designId: "desc" }, { sequence: "asc" }],
    include: {
      design: {
        select: {
          id: true,
          ideaRef: true,
          collectionName: true,
          status: true,
          designNumber: true,
        },
      },
      completedBy: { select: { id: true, name: true } },
    },
    take: options?.designId ? undefined : (options?.take ?? 500),
  });

  const byDesign = new Map<
    string,
    {
      designId: string;
      designNumber: string;
      ideaRef: string;
      collectionName: string;
      designStatus: string;
      stages: typeof stages;
      completedCount: number;
      currentModule: string | null;
    }
  >();

  for (const stage of stages) {
    const key = stage.designId.toString();
    let group = byDesign.get(key);
    if (!group) {
      group = {
        designId: key,
        designNumber: stage.designNumber,
        ideaRef: stage.design.ideaRef,
        collectionName: stage.design.collectionName,
        designStatus: stage.design.status,
        stages: [],
        completedCount: 0,
        currentModule: null,
      };
      byDesign.set(key, group);
    }
    group.stages.push(stage);
    if (stage.status === "COMPLETED") group.completedCount += 1;
    if (
      !group.currentModule &&
      (stage.status === "READY" || stage.status === "IN_PROGRESS")
    ) {
      group.currentModule = stage.erpModule;
    }
  }

  return [...byDesign.values()];
}

export async function getErpStagesForDesign(designId: bigint) {
  return prisma.erpStageRecord.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
    include: {
      completedBy: { select: { id: true, name: true } },
      design: {
        select: { id: true, ideaRef: true, collectionName: true, status: true },
      },
    },
  });
}

export async function startErpStage(
  stageId: bigint,
  actorId: number,
  correlationId: string,
) {
  const stage = await prisma.erpStageRecord.findUnique({ where: { id: stageId } });
  if (!stage) throw new ApiError("ERP stage not found", 404);
  if (stage.status !== "READY" && stage.status !== "IN_PROGRESS") {
    throw new ApiError(`Cannot start stage in status ${stage.status}`, 409);
  }

  const updated = await prisma.erpStageRecord.update({
    where: { id: stageId },
    data: {
      status: "IN_PROGRESS",
      startedAtUtc: stage.startedAtUtc ?? new Date(),
    },
  });

  await writeAuditLogDirect({
    entityType: "ErpStageRecord",
    entityId: stageId.toString(),
    action: "ERP_STAGE_STARTED",
    userId: actorId,
    correlationId,
    before: stage,
    after: updated,
  });

  return updated;
}

/** Prefer marginPercent field from complete input stored in amount for ACCOUNTS when provided. */
async function applyDesignSuccessAfterComplete(
  designId: bigint,
  module: string,
  input: CompleteErpStageInput,
) {
  const { periodYear, periodMonth } = currentPeriod();
  if (module === "READY_STOCK") {
    await upsertDesignSuccessMetric(designId, {
      periodYear,
      periodMonth,
      productionQty: input.qty ?? 0,
    });
    return;
  }
  if (module === "SALES") {
    await upsertDesignSuccessMetric(designId, {
      periodYear,
      periodMonth,
      salesQty: input.qty ?? 0,
      salesValue: input.amount ?? 0,
    });
    return;
  }
  if (module === "SALES_RETURN") {
    await upsertDesignSuccessMetric(designId, {
      periodYear,
      periodMonth,
      returnQty: input.qty ?? 0,
    });
    return;
  }
  if (module === "ACCOUNTS") {
    await upsertDesignSuccessMetric(designId, {
      periodYear,
      periodMonth,
      marginPercent: input.marginPercent ?? input.amount ?? 0,
    });
  }
}

export async function completeErpStage(
  stageId: bigint,
  actorId: number,
  correlationId: string,
  input: CompleteErpStageInput,
) {
  const stage = await prisma.erpStageRecord.findUnique({ where: { id: stageId } });
  if (!stage) throw new ApiError("ERP stage not found", 404);
  if (stage.status !== "READY" && stage.status !== "IN_PROGRESS") {
    throw new ApiError(`Cannot complete stage in status ${stage.status}`, 409);
  }

  if (
    (stage.erpModule === "SALES" || stage.erpModule === "READY_STOCK") &&
    (input.qty == null || input.qty < 0)
  ) {
    throw new ApiError("qty is required for this stage", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const done = await tx.erpStageRecord.update({
      where: { id: stageId },
      data: {
        status: "COMPLETED",
        qty: input.qty ?? stage.qty,
        wastageQty: input.wastageQty ?? stage.wastageQty,
        amount:
          stage.erpModule === "ACCOUNTS" && input.marginPercent != null
            ? input.marginPercent
            : (input.amount ?? stage.amount),
        lotRef: input.lotRef ?? stage.lotRef,
        invoiceRef: input.invoiceRef ?? stage.invoiceRef,
        remark: input.remark ?? stage.remark,
        startedAtUtc: stage.startedAtUtc ?? new Date(),
        completedAtUtc: new Date(),
        completedById: actorId,
      },
    });

    const next = await tx.erpStageRecord.findFirst({
      where: {
        designId: stage.designId,
        sequence: stage.sequence + 1,
        status: "PENDING",
      },
    });
    if (next) {
      await tx.erpStageRecord.update({
        where: { id: next.id },
        data: { status: "READY" },
      });
    }

    return done;
  });

  await writeAuditLogDirect({
    entityType: "ErpStageRecord",
    entityId: stageId.toString(),
    action: "ERP_STAGE_COMPLETED",
    userId: actorId,
    correlationId,
    before: stage,
    after: updated,
  });

  await applyDesignSuccessAfterComplete(stage.designId, stage.erpModule, input);

  return updated;
}

export async function ensureErpStagesForReleasedDesigns(actorId: number, correlationId: string) {
  const released = await prisma.designConcept.findMany({
    where: {
      status: { in: ["PRODUCTION_RELEASED", "LIVE"] },
      designNumber: { not: null },
      erpStages: { none: {} },
    },
    select: { id: true, designNumber: true },
    take: 50,
  });

  const results = [];
  for (const design of released) {
    if (!design.designNumber) continue;
    const stages = await seedErpStagesForDesign(
      design.id,
      design.designNumber,
      actorId,
      correlationId,
    );
    results.push({ designId: design.id.toString(), count: stages.length });
  }
  return results;
}
