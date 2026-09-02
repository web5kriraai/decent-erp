import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import { designHasCosting } from "@/lib/services/costing-service";
import type { ApprovalDecision } from "@prisma/client";
import { unlockProductionHandoffTask } from "@/lib/services/production-handoff-unlock";
import {
  buildPendingApprovalItems,
  canEmployeeActOnApprovalLevel,
  isDesignReadyForSignOff,
  readyForSignOffScopeFilter,
} from "@/lib/services/approval-queue-utils";
import type {
  PendingApprovalQueueItem,
  ReadyForSignOffItem,
} from "@/lib/types/api";

export type { PendingApprovalQueueItem, ReadyForSignOffItem } from "@/lib/types/api";

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

export { canEmployeeActOnApprovalLevel, isDesignReadyForSignOff } from "@/lib/services/approval-queue-utils";

const SATISFIED_TASK = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

export async function listPendingApprovals(): Promise<PendingApprovalQueueItem[]> {
  const levels = await getApprovalLevels();
  const designs = await prisma.designConcept.findMany({
    where: { status: "APPROVAL_PENDING" },
    include: {
      approvals: { include: { level: true }, orderBy: { decisionAtUtc: "desc" } },
      tasks: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          status: true,
          sequence: true,
          process: { select: { name: true } },
          subProcess: { select: { name: true, code: true, isApproval: true } },
        },
      },
    },
    orderBy: { updatedAtUtc: "desc" },
  });

  return buildPendingApprovalItems(
    designs.map((d) => ({
      id: d.id,
      ideaRef: d.ideaRef,
      collectionName: d.collectionName,
      status: d.status,
      priority: d.priority,
      approvals: d.approvals,
      tasks: d.tasks,
    })),
    levels,
  ) as PendingApprovalQueueItem[];
}

export async function listPendingApprovalsForEmployee(
  employeeId: number,
): Promise<PendingApprovalQueueItem[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { role: true },
  });
  if (!employee) return [];

  const allPending = await listPendingApprovals();
  return allPending.filter((item) =>
    canEmployeeActOnApprovalLevel(item.currentLevel, employee.roleId, employee.role?.code),
  );
}

export async function listDesignsReadyForSignOff(
  employeeId: number,
  roleCode?: string | null,
): Promise<ReadyForSignOffItem[]> {
  if (roleCode && roleCode !== "DESIGN_HEAD") return [];

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { role: true },
  });
  if (!employee) return [];

  const portfolioFilter = readyForSignOffScopeFilter(employeeId, employee.role?.code);

  const designs = await prisma.designConcept.findMany({
    where: {
      status: { in: ["DRAFT", "ACTIVE"] },
      ...portfolioFilter,
    },
    include: {
      tasks: {
        select: {
          status: true,
          updatedAtUtc: true,
          subProcess: { select: { code: true, isApproval: true } },
        },
      },
    },
    orderBy: { updatedAtUtc: "desc" },
  });

  return designs
    .filter((design) => design.tasks.length > 0 && isDesignReadyForSignOff(design.tasks))
    .map((design) => {
      const completedTasks = design.tasks.filter((t) => SATISFIED_TASK.has(t.status));
      const latestCompleted = completedTasks.reduce<Date | null>((latest, task) => {
        if (!latest || task.updatedAtUtc > latest) return task.updatedAtUtc;
        return latest;
      }, null);

      return {
        designId: design.id.toString(),
        ideaRef: design.ideaRef,
        collectionName: design.collectionName,
        completedAt: latestCompleted?.toISOString() ?? null,
      };
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
      if (
        !canEmployeeActOnApprovalLevel(
          { requiredRoleId: level.requiredRoleId, code: level.code },
          approver?.roleId,
          approver?.role?.code,
        )
      ) {
        throw new ApiError(
          `This approval level requires role ${requiredRole?.name ?? "with matching permissions"} — you are not authorized`,
          403,
        );
      }
    }

    const existingActive = await tx.designApproval.findFirst({
      where: {
        designId: input.designId,
        approvalLevelId: input.approvalLevelId,
        decision: { in: ["PENDING", "APPROVED", "SKIPPED"] },
      },
      select: { id: true, decision: true },
    });
    if (existingActive) {
      throw new ApiError(
        existingActive.decision === "PENDING"
          ? "An active approval is already pending at this level"
          : "This approval level is already recorded for this design",
        409,
      );
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
