import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import { designHasCosting } from "@/lib/services/costing-service";
import type { ApprovalDecision } from "@prisma/client";
import { unlockProductionHandoffTask } from "@/lib/services/production-handoff-unlock";

const approvalInclude = {
  design: {
    select: { id: true, ideaRef: true, collectionName: true, status: true },
  },
  level: true,
  approver: { select: { id: true, name: true, employeeCode: true } },
  task: {
    select: {
      id: true,
      process: { select: { name: true } },
      subProcess: { select: { name: true } },
    },
  },
} as const;

export async function getApprovalLevels() {
  return prisma.approvalLevel.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
  });
}

export async function listPendingApprovals() {
  const levels = await getApprovalLevels();
  const designs = await prisma.designConcept.findMany({
    where: { status: "APPROVAL_PENDING" },
    include: {
      approvals: { include: { level: true }, orderBy: { decisionAtUtc: "desc" } },
      tasks: {
        take: 1,
        orderBy: { id: "desc" },
        include: {
          process: { select: { name: true } },
          subProcess: { select: { name: true } },
        },
      },
    },
    orderBy: { updatedAtUtc: "desc" },
  });

  return designs.flatMap((design) => {
    const passedLevelIds = new Set(
      design.approvals
        .filter((a) => a.decision === "APPROVED" || a.decision === "SKIPPED")
        .map((a) => a.approvalLevelId),
    );
    const nextLevel = levels.find((l) => !passedLevelIds.has(l.id));
    if (!nextLevel) return [];

    const existingPending = design.approvals.find(
      (a) => a.approvalLevelId === nextLevel.id && a.decision === "PENDING",
    );

    return [
      {
        designId: design.id.toString(),
        design: {
          id: design.id.toString(),
          ideaRef: design.ideaRef,
          collectionName: design.collectionName,
          status: design.status,
        },
        currentLevel: nextLevel,
        task: design.tasks[0]
          ? {
              id: design.tasks[0].id.toString(),
              process: design.tasks[0].process,
              subProcess: design.tasks[0].subProcess,
            }
          : null,
        existingApprovalId: existingPending?.id.toString() ?? null,
      },
    ];
  });
}

export async function requestDesignApproval(
  designId: bigint,
  requesterId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);
    if (!["DRAFT", "ACTIVE"].includes(design.status)) {
      throw new ApiError("Design cannot enter approval from current status", 422);
    }

    const levels = await tx.approvalLevel.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    if (levels.length === 0) {
      throw new ApiError("No approval levels configured", 422);
    }

    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: { status: "APPROVAL_PENDING" },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "REQUEST_APPROVAL",
      userId: requesterId,
      correlationId,
      before: design,
      after: updated,
    });

    return updated;
  }).then(async (design) => {
    await enqueueOutboxAndNotify(
      "APPROVAL_PENDING",
      { designId: design.id.toString(), ideaRef: design.ideaRef },
      correlationId,
    );
    return design;
  });
}

export async function submitApproval(
  input: {
    designId: bigint;
    taskId?: bigint;
    approvalLevelId: number;
    decision: ApprovalDecision;
    remark?: string;
  },
  approverEmployeeId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: input.designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const level = await tx.approvalLevel.findUnique({ where: { id: input.approvalLevelId } });
    if (!level) throw new ApiError("Approval level not found", 404);

    if (level.requiredRoleId) {
      const approver = await tx.employee.findUnique({
        where: { id: approverEmployeeId },
        include: { role: true },
      });
      const requiredRole = await tx.role.findUnique({ where: { id: level.requiredRoleId } });
      const isAdmin = approver?.role?.code === "ADMIN";
      if (!isAdmin && approver?.roleId !== level.requiredRoleId) {
        throw new ApiError(
          `This approval level requires role ${requiredRole?.name ?? "with matching permissions"} — you are not authorized`,
          403,
        );
      }
    }

    const approval = await tx.designApproval.create({
      data: {
        designId: input.designId,
        taskId: input.taskId,
        approvalLevelId: input.approvalLevelId,
        approverEmployeeId,
        decision: input.decision,
        remark: input.remark,
        decisionAtUtc: new Date(),
      },
      include: approvalInclude,
    });

    if (input.decision === "REJECTED") {
      await tx.designConcept.update({
        where: { id: input.designId },
        data: { status: "REJECTED" },
      });
    } else if (input.decision === "APPROVED") {
      const levels = await tx.approvalLevel.findMany({
        where: { active: true },
        orderBy: { sequence: "asc" },
      });
      const approvals = await tx.designApproval.findMany({
        where: { designId: input.designId, decision: { in: ["APPROVED", "SKIPPED"] } },
      });
      const passedIds = new Set([...approvals.map((a) => a.approvalLevelId), input.approvalLevelId]);
      const allPassed = levels.every((l) => passedIds.has(l.id));
      if (allPassed) {
        const hasCosting = await designHasCosting(input.designId);
        if (!hasCosting) {
          throw new ApiError("Costing must be complete before final approval", 422);
        }
        await tx.designConcept.update({
          where: { id: input.designId },
          data: { status: "APPROVED" },
        });
        await unlockProductionHandoffTask(tx, input.designId, correlationId);
      }
    } else if (input.decision === "CORRECTION_REQUIRED") {
      await tx.designConcept.update({
        where: { id: input.designId },
        data: { status: "ACTIVE" },
      });
      if (input.taskId) {
        const task = await tx.designTask.findUnique({
          where: { id: input.taskId },
          include: { assignedEmployee: true, subProcess: { select: { code: true } } },
        });
        await tx.designTask.update({
          where: { id: input.taskId },
          data: { status: "CORRECTION_REQUIRED" },
        });
        await tx.designCorrection.create({
          data: {
            designId: input.designId,
            taskId: input.taskId,
            correctionType: "IMPROVEMENT",
            responsibleEmployeeId: task?.assignedEmployeeId ?? null,
            raisedById: approverEmployeeId,
            rootCause: input.remark ?? "Approval returned for correction",
            status: "OPEN",
            ratingImpact: 0,
          },
        });
        await tx.designImage.updateMany({
          where: { designId: input.designId, isPrimary: false },
          data: {
            reviewStatus: "REJECTED",
            reviewNote: input.remark ?? "Returned during approval",
          },
        });
      }
    }

    await writeAuditLog(tx, {
      entityType: "DesignApproval",
      entityId: approval.id.toString(),
      action: input.decision,
      userId: approverEmployeeId,
      correlationId,
      after: approval,
    });

    return approval;
  });
}

export async function getDesignApprovalStatus(designId: bigint) {
  const [design, levels, approvals] = await Promise.all([
    prisma.designConcept.findUnique({ where: { id: designId } }),
    getApprovalLevels(),
    prisma.designApproval.findMany({
      where: { designId },
      include: { level: true, approver: { select: { id: true, name: true } } },
      orderBy: { decisionAtUtc: "desc" },
    }),
  ]);
  if (!design) throw new ApiError("Design not found", 404);

  const passedLevelIds = new Set(
    approvals
      .filter((a) => a.decision === "APPROVED" || a.decision === "SKIPPED")
      .map((a) => a.approvalLevelId),
  );
  const currentLevel = levels.find((l) => !passedLevelIds.has(l.id)) ?? null;

  return { design, levels, approvals, currentLevel, allPassed: !currentLevel };
}
