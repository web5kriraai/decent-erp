import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import type { CorrectionType, CorrectionStatus } from "@prisma/client";

const correctionInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true } },
  task: {
    select: {
      id: true,
      process: { select: { name: true, code: true } },
      subProcess: { select: { name: true, code: true } },
    },
  },
  raisedBy: { select: { id: true, name: true, employeeCode: true } },
  responsibleEmployee: { select: { id: true, name: true, employeeCode: true } },
} as const;

export async function listCorrections(filters: {
  designId?: bigint;
  responsibleEmployeeId?: number;
  status?: CorrectionStatus;
}) {
  return prisma.designCorrection.findMany({
    where: {
      ...(filters.designId ? { designId: filters.designId } : {}),
      ...(filters.responsibleEmployeeId
        ? { responsibleEmployeeId: filters.responsibleEmployeeId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: correctionInclude,
    orderBy: { createdAtUtc: "desc" },
  });
}

export async function createCorrection(
  input: {
    designId: bigint;
    taskId: bigint;
    correctionType: CorrectionType;
    responsibleEmployeeId: number;
    rootCause?: string;
    extraMinutes?: number;
    extraCost?: number;
  },
  raisedById: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const correction = await tx.designCorrection.create({
      data: {
        ...input,
        raisedById,
        status: "OPEN",
      },
    });

    await tx.designTask.update({
      where: { id: input.taskId },
      data: { status: "CORRECTION_REQUIRED" },
    });

    await writeAuditLog(tx, {
      entityType: "DesignCorrection",
      entityId: correction.id.toString(),
      action: "CREATE",
      userId: raisedById,
      correlationId,
      after: correction,
    });

    return tx.designCorrection.findUniqueOrThrow({
      where: { id: correction.id },
      include: correctionInclude,
    });
  }).then(async (correction) => {
    await enqueueOutboxAndNotify(
      "CORRECTION_RAISED",
      {
        correctionId: correction.id.toString(),
        designId: correction.designId.toString(),
        taskId: correction.taskId.toString(),
        responsibleEmployeeId: correction.responsibleEmployeeId,
      },
      correlationId,
    );
    return correction;
  });
}

export async function updateCorrection(
  id: bigint,
  input: {
    status?: CorrectionStatus;
    rootCause?: string;
    extraMinutes?: number;
    extraCost?: number;
  },
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.designCorrection.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Correction not found", 404);

    const updated = await tx.designCorrection.update({
      where: { id },
      data: input,
      include: correctionInclude,
    });

    await writeAuditLog(tx, {
      entityType: "DesignCorrection",
      entityId: id.toString(),
      action: "UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
