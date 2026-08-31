import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import type { CorrectionType, CorrectionStatus } from "@prisma/client";

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
