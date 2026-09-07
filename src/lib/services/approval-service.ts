import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { designHasCosting } from "@/lib/services/costing-service";
import type { ApprovalDecision } from "@prisma/client";
import { ensureProductionLadderAndUnlock } from "@/lib/services/production-handoff-unlock";
import { raiseCorrectionInTransaction } from "@/lib/services/correction-service";
import {
  buildPendingApprovalItems,
  canEmployeeActOnApprovalLevel,
  isDesignReadyForSignOff,
  readyForSignOffScopeFilter,
} from "@/lib/services/approval-queue-utils";
import { validateManagementSignOffRequest } from "@/lib/approval-request-package";
import type {
  PendingApprovalQueueItem,
  ReadyForSignOffItem,
} from "@/lib/types/api";
import { correctionRouteCodesFromStages } from "@/lib/workflow/correction-routes";
import {
  designRequiresCosting,
  evaluateTransition,
} from "@/lib/workflow/transition-policies";

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
          assignedEmployeeId: true,
          process: { select: { name: true } },
          subProcess: {
            select: {
              name: true,
              code: true,
              isApproval: true,
              isFileRequired: true,
              capabilities: true,
            },
          },
          assignedEmployee: { select: { id: true, name: true } },
        },
      },
      costs: { where: { amount: { gt: 0 } }, select: { id: true }, take: 1 },
    },
    // approvalRequestPackage is a top-level scalar — included automatically
    orderBy: { updatedAtUtc: "desc" },
  });

  const designIdsWithCosting = new Set(
    designs.filter((d) => d.costs.length > 0).map((d) => d.id.toString()),
  );
  const designIdsRequiringCosting = new Set(
    designs
      .filter((d) => designRequiresCosting(d.tasks))
      .map((d) => d.id.toString()),
  );

  return buildPendingApprovalItems(
    designs.map((d) => ({
      id: d.id,
      ideaRef: d.ideaRef,
      collectionName: d.collectionName,
      status: d.status,
      priority: d.priority,
      approvalRequestPackage: d.approvalRequestPackage,
      approvals: d.approvals,
      tasks: d.tasks,
    })),
    levels,
    { designIdsWithCosting, designIdsRequiringCosting },
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
  if (employee.role?.code === "ADMIN") return allPending;
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
          subProcess: {
            select: {
              code: true,
              isApproval: true,
              isFileRequired: true,
              capabilities: true,
            },
          },
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
  input?: {
    requesterRemark: string;
    summaryNote?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const requester = await tx.employee.findUnique({
      where: { id: requesterId },
      include: { role: { select: { code: true, name: true } } },
    });
    if (!requester) throw new ApiError("Requester not found", 404);

    const validated = validateManagementSignOffRequest({
      roleCode: requester.role?.code,
      requesterRemark: input?.requesterRemark,
    });
    if (!validated.ok) {
      throw new ApiError(validated.message, validated.status);
    }
    const remark = validated.remark;

    const design = await tx.designConcept.findUnique({
      where: { id: designId },
      include: {
        productType: { select: { name: true } },
        costs: { select: { amount: true }, take: 50 },
        corrections: {
          where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"] } },
          select: { id: true, correctionType: true, rootCause: true },
        },
        approvals: {
          where: { decision: { not: "PENDING" } },
          orderBy: { decisionAtUtc: "asc" },
          select: {
            decision: true,
            remark: true,
            decisionAtUtc: true,
            level: { select: { name: true } },
            approver: { select: { name: true } },
          },
        },
        tasks: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            status: true,
            outputRemark: true,
            completedAt: true,
            assignedEmployeeId: true,
            subProcess: {
              select: {
                code: true,
                name: true,
                isApproval: true,
                isFileRequired: true,
                capabilities: true,
              },
            },
            assignedEmployee: { select: { id: true, name: true } },
          },
        },
        images: {
          select: { id: true, fileName: true, isPrimary: true },
          take: 5,
          orderBy: [{ isPrimary: "desc" }, { uploadedAtUtc: "desc" }],
        },
      },
    });
    if (!design) throw new ApiError("Design not found", 404);
    if (design.status === "APPROVAL_PENDING") {
      return design;
    }
    if (!["DRAFT", "ACTIVE"].includes(design.status)) {
      throw new ApiError("Design cannot be submitted for management approval from current status", 422);
    }

    const stagesComplete =
      design.tasks.length > 0 && isDesignReadyForSignOff(design.tasks);
    const hasCosting = await designHasCosting(designId, tx);
    const transition = evaluateTransition({
      transition: "design.sign_off",
      tasks: design.tasks,
      hasCosting,
      stagesComplete,
    });
    if (!transition.ok) {
      const blocker = transition.blockers[0]!;
      throw new ApiError(
        blocker.message,
        422,
        undefined,
        blocker.code === APP_ERROR_CODES.COSTING_REQUIRED
          ? APP_ERROR_CODES.COSTING_REQUIRED
          : undefined,
      );
    }

    const positiveCosts = design.costs.filter((c) => Number(c.amount) > 0);
    const totalCost = positiveCosts.reduce((sum, c) => sum + Number(c.amount), 0);
    const completedTasks = design.tasks.filter((t) =>
      ["COMPLETED", "CHECKING", "SKIPPED"].includes(t.status),
    );
    const completedStageDetails = completedTasks.map((t) => ({
      code: t.subProcess.code,
      name: t.subProcess.name,
      outputRemark: t.outputRemark ?? null,
      assigneeName: t.assignedEmployee?.name ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    }));
    const completedStages = completedStageDetails.map((d) => d.name);

    const stageAssignees = design.tasks
      .filter((t) => !t.subProcess.isApproval)
      .map((t) => ({
        code: t.subProcess.code,
        name: t.subProcess.name,
        assigneeEmployeeId: t.assignedEmployeeId ?? t.assignedEmployee?.id ?? null,
        assigneeName: t.assignedEmployee?.name ?? null,
      }));

    const openCorrectionBriefs = design.corrections.map((c) => ({
      id: c.id.toString(),
      type: c.correctionType,
      rootCause: c.rootCause ?? null,
    }));

    const priorManagementDecisions = design.approvals.map((a) => ({
      levelName: a.level.name,
      decision: a.decision,
      remark: a.remark ?? null,
      decidedBy: a.approver?.name ?? null,
      decidedAt: a.decisionAtUtc?.toISOString() ?? null,
    }));

    const packagePayload = {
      requesterEmployeeId: requester.id,
      requesterName: requester.name,
      requestedAtUtc: new Date().toISOString(),
      requesterRemark: remark,
      summaryNote: input?.summaryNote?.trim() || null,
      snapshot: {
        ideaRef: design.ideaRef,
        collectionName: design.collectionName,
        productType: design.productType.name,
        priority: design.priority,
        statusBeforeRequest: design.status,
        completedStages,
        completedStageDetails,
        openCorrections: design.corrections.length,
        openCorrectionBriefs,
        priorManagementDecisions,
        costingEntryCount: positiveCosts.length,
        costingTotal: totalCost,
        requiresCosting: transition.meta.requiresCosting,
        primaryFiles: design.images.map((img) => ({
          id: img.id.toString(),
          fileName: img.fileName,
          isPrimary: img.isPrimary,
        })),
        stageAssignees,
      },
    };

    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: {
        status: "APPROVAL_PENDING",
        approvalRequestPackage: packagePayload,
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "APPROVAL_REQUESTED",
      userId: requesterId,
      correlationId,
      before: { status: design.status },
      after: { status: updated.status, approvalRequestPackage: packagePayload },
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

/**
 * Checker → Design Head → Management decide chain (spec Stage 9).
 * Final level APPROVED marks design APPROVED and unlocks production ladder.
 */
export async function submitApproval(
  input: {
    designId: bigint;
    taskId?: bigint;
    approvalLevelId: number;
    decision: ApprovalDecision;
    remark?: string;
    correctionType?: string;
    routeSubProcessCode?: string;
    responsibleEmployeeId?: number;
  },
  approverEmployeeId: number,
  correlationId: string,
) {
  return submitApprovalChain(input, approverEmployeeId, correlationId);
}

/** @deprecated Alias — use submitApproval. */
export async function submitApprovalLegacy(
  input: {
    designId: bigint;
    taskId?: bigint;
    approvalLevelId: number;
    decision: ApprovalDecision;
    remark?: string;
    correctionType?: string;
    routeSubProcessCode?: string;
    responsibleEmployeeId?: number;
  },
  approverEmployeeId: number,
  correlationId: string,
) {
  return submitApprovalChain(input, approverEmployeeId, correlationId);
}

async function submitApprovalChain(
  input: {
    designId: bigint;
    taskId?: bigint;
    approvalLevelId: number;
    decision: ApprovalDecision;
    remark?: string;
    correctionType?: string;
    routeSubProcessCode?: string;
    responsibleEmployeeId?: number;
  },
  approverEmployeeId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: input.designId } });
    if (!design) throw new ApiError("Design not found", 404);
    if (design.status !== "APPROVAL_PENDING") {
      throw new ApiError(
        "Design must be awaiting management approval (Design Head request sign-off first)",
        422,
      );
    }

    const level = await tx.approvalLevel.findUnique({ where: { id: input.approvalLevelId } });
    if (!level) throw new ApiError("Approval level not found", 404);

    const activeLevels = await tx.approvalLevel.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    const passedApprovals = await tx.designApproval.findMany({
      where: { designId: input.designId, decision: { in: ["APPROVED", "SKIPPED"] } },
      select: { approvalLevelId: true },
    });
    const passedIds = new Set(passedApprovals.map((a) => a.approvalLevelId));
    const nextRequired = activeLevels.find((l) => !passedIds.has(l.id));
    if (!nextRequired || nextRequired.id !== input.approvalLevelId) {
      throw new ApiError(
        nextRequired
          ? `Next required approval is ${nextRequired.name}, not ${level.name}`
          : "All management approval levels are already complete",
        409,
      );
    }

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
        const designTasks = await tx.designTask.findMany({
          where: { designId: input.designId },
          select: {
            status: true,
            subProcess: {
              select: {
                code: true,
                name: true,
                isApproval: true,
                isFileRequired: true,
                capabilities: true,
              },
            },
          },
        });
        const hasCosting = await designHasCosting(input.designId, tx);
        const transition = evaluateTransition({
          transition: "design.sign_off",
          tasks: designTasks,
          hasCosting,
          stagesComplete: true,
        });
        if (!transition.ok) {
          const blocker = transition.blockers[0]!;
          throw new ApiError(
            blocker.message,
            422,
            undefined,
            blocker.code === APP_ERROR_CODES.COSTING_REQUIRED
              ? APP_ERROR_CODES.COSTING_REQUIRED
              : undefined,
          );
        }
        await tx.designConcept.update({
          where: { id: input.designId },
          data: { status: "APPROVED" },
        });
        await ensureProductionLadderAndUnlock(tx, input.designId, correlationId);
      }
    } else if (input.decision === "CORRECTION_REQUIRED") {
      if (!input.remark?.trim()) {
        throw new ApiError("A remark is required when sending for correction.", 400);
      }

      await tx.designConcept.update({
        where: { id: input.designId },
        data: { status: "ACTIVE" },
      });

      // Full chain must re-approve after correction (keep this CORRECTION_REQUIRED row for history).
      await tx.designApproval.deleteMany({
        where: {
          designId: input.designId,
          id: { not: approval.id },
          decision: { in: ["APPROVED", "PENDING", "SKIPPED"] },
        },
      });

      let sourceTaskId = input.taskId ?? null;
      if (!sourceTaskId) {
        const fallback = await tx.designTask.findFirst({
          where: {
            designId: input.designId,
            subProcess: {
              code: { in: ["FINAL_APPROVAL", "COSTING", "SAMPLE_CHECK", "PUNCH", "SKETCH"] },
            },
          },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });
        sourceTaskId = fallback?.id ?? null;
      }

      const designTasks = await tx.designTask.findMany({
        where: { designId: input.designId },
        include: {
          subProcess: {
            select: {
              id: true,
              code: true,
              name: true,
              isCorrectionAllowed: true,
              capabilities: true,
            },
          },
          assignedEmployee: { select: { id: true, name: true } },
        },
        orderBy: { sequence: "asc" },
      });

      const signOffRoutes = correctionRouteCodesFromStages(
        designTasks.map((t) => ({
          code: t.subProcess.code,
          name: t.subProcess.name,
          isCorrectionAllowed: t.subProcess.isCorrectionAllowed,
          capabilities: t.subProcess.capabilities,
        })),
      );

      const preferredCodes = input.routeSubProcessCode
        ? [input.routeSubProcessCode, ...signOffRoutes]
        : [...signOffRoutes];

      const routeTask =
        preferredCodes
          .map((code) => designTasks.find((t) => t.subProcess.code === code))
          .find(Boolean) ?? null;

      let raisedCorrectionId: string | null = null;
      let routedAssigneeName: string | null = null;
      let routedStageName: string | null = null;

      const correctionType =
        (input.correctionType as
          | "MISTAKE"
          | "IMPROVEMENT"
          | "CUSTOMER_CHANGE"
          | "MACHINE"
          | "MATERIAL"
          | "OTHER") ?? "IMPROVEMENT";

      if (sourceTaskId && routeTask?.subProcess) {
        const routeOwner =
          input.responsibleEmployeeId ??
          designTasks.find((t) => t.subProcess.id === routeTask.subProcess.id)?.assignedEmployeeId ??
          null;
        routedAssigneeName =
          designTasks.find((t) => t.assignedEmployeeId === routeOwner)?.assignedEmployee?.name ??
          routeTask.assignedEmployee?.name ??
          null;
        routedStageName = routeTask.subProcess.name;
        const correction = await raiseCorrectionInTransaction(
          tx,
          {
            designId: input.designId,
            taskId: sourceTaskId,
            correctionType,
            responsibleEmployeeId: routeOwner,
            routeToSubProcessId: routeTask.subProcess.id,
            rootCause: input.remark ?? "Approval returned for correction",
          },
          approverEmployeeId,
          correlationId,
        );
        raisedCorrectionId = correction.id.toString();
      } else if (sourceTaskId) {
        await tx.designTask.update({
          where: { id: sourceTaskId },
          data: { status: "CORRECTION_REQUIRED", version: { increment: 1 } },
        });
        const correction = await tx.designCorrection.create({
          data: {
            designId: input.designId,
            taskId: sourceTaskId,
            correctionType,
            raisedById: approverEmployeeId,
            responsibleEmployeeId: input.responsibleEmployeeId ?? null,
            rootCause: input.remark ?? "Approval returned for correction",
            status: "OPEN",
            ratingImpact: 0,
          },
        });
        raisedCorrectionId = correction.id.toString();
      }

      await tx.designImage.updateMany({
        where: { designId: input.designId, isPrimary: false },
        data: {
          reviewStatus: "REJECTED",
          reviewNote: input.remark ?? "Returned during approval",
        },
      });

      await writeAuditLog(tx, {
        entityType: "DesignApproval",
        entityId: approval.id.toString(),
        action: input.decision,
        userId: approverEmployeeId,
        correlationId,
        after: approval,
      });

      return {
        ...approval,
        chainComplete: false,
        designStatus: "ACTIVE" as const,
        nextLevel: null,
        correctionId: raisedCorrectionId,
        routedAssigneeName,
        routedStageName,
      };
    }

    await writeAuditLog(tx, {
      entityType: "DesignApproval",
      entityId: approval.id.toString(),
      action: input.decision,
      userId: approverEmployeeId,
      correlationId,
      after: approval,
    });

    let designStatus: string = design.status;
    let chainComplete = false;
    let nextLevel: { id: number; code: string; name: string; sequence: number } | null = null;

    if (input.decision === "REJECTED") {
      designStatus = "REJECTED";
    } else if (input.decision === "APPROVED") {
      const levels = await tx.approvalLevel.findMany({
        where: { active: true },
        orderBy: { sequence: "asc" },
      });
      const approvals = await tx.designApproval.findMany({
        where: { designId: input.designId, decision: { in: ["APPROVED", "SKIPPED"] } },
      });
      const passedIds = new Set(approvals.map((a) => a.approvalLevelId));
      const remaining = levels.find((l) => !passedIds.has(l.id));
      const updatedDesign = await tx.designConcept.findUnique({
        where: { id: input.designId },
        select: { status: true },
      });
      designStatus = updatedDesign?.status ?? design.status;
      chainComplete = !remaining && designStatus === "APPROVED";
      nextLevel = remaining
        ? {
            id: remaining.id,
            code: remaining.code,
            name: remaining.name,
            sequence: remaining.sequence,
          }
        : null;
    }

    return {
      ...approval,
      chainComplete,
      designStatus,
      nextLevel,
      correctionId: null as string | null,
      routedAssigneeName: null as string | null,
      routedStageName: null as string | null,
    };
  }).then(async (result) => {
    if (input.decision === "CORRECTION_REQUIRED" && result.correctionId) {
      await enqueueOutboxAndNotify(
        "CORRECTION_RAISED",
        {
          correctionId: result.correctionId,
          designId: input.designId.toString(),
          taskId: input.taskId?.toString(),
        },
        correlationId,
      );
    } else if (result.chainComplete && result.designStatus === "APPROVED") {
      await enqueueOutboxAndNotify(
        "DESIGN_APPROVED",
        { designId: input.designId.toString() },
        correlationId,
      );
    }
    return result;
  });
}

/**
 * One-shot heal: APPROVAL_PENDING designs with complete stages + costing → APPROVED.
 * Skips designs that fail costing or are not ready for sign-off.
 */
export async function healApprovalPendingDesigns(
  correlationId: string,
  actorUserId: number,
): Promise<{
  healed: string[];
  skipped: Array<{ designId: string; reason: string }>;
}> {
  const pending = await prisma.designConcept.findMany({
    where: { status: "APPROVAL_PENDING" },
    select: {
      id: true,
      ideaRef: true,
      tasks: {
        select: {
          status: true,
          subProcess: {
            select: {
              code: true,
              isApproval: true,
              isFileRequired: true,
              capabilities: true,
            },
          },
        },
      },
    },
  });

  const healed: string[] = [];
  const skipped: Array<{ designId: string; reason: string }> = [];

  for (const design of pending) {
    const designId = design.id.toString();
    const stagesComplete = isDesignReadyForSignOff(design.tasks);
    const hasCosting = await designHasCosting(design.id);
    const transition = evaluateTransition({
      transition: "design.sign_off",
      tasks: design.tasks,
      hasCosting,
      stagesComplete,
    });
    if (!transition.ok) {
      const reason =
        transition.blockers[0]?.code === APP_ERROR_CODES.COSTING_REQUIRED
          ? "costing missing"
          : "stages incomplete";
      skipped.push({ designId, reason });
      continue;
    }

    const levels = await prisma.approvalLevel.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    if (levels.length > 0) {
      const approvals = await prisma.designApproval.findMany({
        where: { designId: design.id, decision: { in: ["APPROVED", "SKIPPED"] } },
        select: { approvalLevelId: true },
      });
      const passed = new Set(approvals.map((a) => a.approvalLevelId));
      const missingLevel = levels.find((l) => !passed.has(l.id));
      if (missingLevel) {
        skipped.push({ designId, reason: `management chain incomplete (${missingLevel.name})` });
        continue;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.designConcept.update({
        where: { id: design.id },
        data: { status: "APPROVED" },
      });
      await ensureProductionLadderAndUnlock(tx, design.id, correlationId);
      await writeAuditLog(tx, {
        entityType: "DesignConcept",
        entityId: designId,
        action: "HEAL_APPROVAL_PENDING",
        userId: actorUserId,
        correlationId,
        before: { status: "APPROVAL_PENDING" },
        after: { status: "APPROVED" },
      });
    });
    healed.push(designId);
  }

  return { healed, skipped };
}
