import { prisma } from "@/lib/db";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";
import {
  listDesignsReadyForSignOff,
  listPendingApprovalsForEmployee,
} from "@/lib/services/approval-service";

export async function getDesignHeadWorkbenchSummary(designHeadId: number) {
  const now = new Date();

  const [
    myOpenTasks,
    overdueTasks,
    handoffTasks,
    blockedDesigns,
    activeDesigns,
    openCorrections,
    stageApprovals,
    readyForSignOff,
  ] = await Promise.all([
    prisma.designTask.count({
      where: {
        assignedEmployeeId: designHeadId,
        status: { in: ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "CORRECTION_REQUIRED"] },
      },
    }),
    prisma.designTask.count({
      where: {
        assignedEmployeeId: designHeadId,
        dueAt: { lt: now },
        status: { in: ["ASSIGNED", "RUNNING", "ON_HOLD"] },
      },
    }),
    prisma.designTask.findMany({
      where: {
        assignedEmployeeId: designHeadId,
        subProcess: { code: "PROD_HANDOFF" },
        status: { in: ["ASSIGNED", "RUNNING", "ON_HOLD"] },
      },
      take: 8,
      include: {
        design: { select: { id: true, ideaRef: true, collectionName: true, status: true } },
        subProcess: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.designConcept.findMany({
      where: {
        designHeadEmployeeId: designHeadId,
        status: { in: ["ACTIVE", "APPROVAL_PENDING", "ON_HOLD"] },
        tasks: {
          some: {
            status: { in: ["CORRECTION_REQUIRED", "ON_HOLD", "CHECKING"] },
          },
        },
      },
      take: 8,
      select: {
        id: true,
        ideaRef: true,
        collectionName: true,
        status: true,
        priority: true,
      },
      orderBy: { updatedAtUtc: "desc" },
    }),
    prisma.designConcept.count({
      where: {
        designHeadEmployeeId: designHeadId,
        status: { in: ["ACTIVE", "APPROVAL_PENDING", "ON_HOLD", "DRAFT"] },
      },
    }),
    prisma.designCorrection.count({
      where: {
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"] },
        design: { designHeadEmployeeId: designHeadId },
      },
    }),
    listStageApprovalQueue(designHeadId),
    listDesignsReadyForSignOff(designHeadId),
  ]);

  return {
    myOpenTasks,
    overdueTasks,
    handoffPending: handoffTasks.length,
    handoffTasks,
    blockedDesigns,
    activeDesigns,
    openCorrections,
    stageApprovals,
    readyForSignOff: readyForSignOff.length,
    readyForSignOffDesigns: readyForSignOff.slice(0, 8),
  };
}

export async function getManagementWorkbenchSummary(employeeId: number) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const managementLevel = await prisma.approvalLevel.findFirst({
    where: { code: "MANAGEMENT_APPROVAL", active: true },
  });

  const actionableApprovals = await listPendingApprovalsForEmployee(employeeId);

  const actionableDesignIds = new Set(actionableApprovals.map((item) => item.designId));

  const [
    blockedInApproval,
    approvedCount,
    releasedCount,
    underDevelopment,
    liveReviewTasks,
  ] = await Promise.all([
    prisma.designConcept.count({
      where: {
        status: "APPROVAL_PENDING",
        updatedAtUtc: { lt: thirtyDaysAgo },
      },
    }),
    prisma.designConcept.count({ where: { status: { in: ["APPROVED", "PRODUCTION_ACCEPTED"] } } }),
    prisma.designConcept.count({ where: { status: "PRODUCTION_RELEASED" } }),
    prisma.designConcept.count({
      where: { status: { in: ["ACTIVE", "APPROVAL_PENDING", "ON_HOLD"] } },
    }),
    prisma.designTask.findMany({
      where: {
        subProcess: { code: "LIVE_REVIEW" },
        status: { in: ["ASSIGNED", "RUNNING", "ON_HOLD"] },
        design: { status: "PRODUCTION_RELEASED" },
      },
      take: 8,
      include: {
        design: { select: { id: true, ideaRef: true, collectionName: true, status: true } },
        subProcess: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const highPriorityActionable =
    actionableDesignIds.size === 0
      ? 0
      : await prisma.designConcept.count({
          where: {
            status: "APPROVAL_PENDING",
            priority: { in: ["HIGH", "URGENT"] },
            id: { in: [...actionableDesignIds].map((id) => BigInt(id)) },
          },
        });

  const priorityByDesignId = new Map(
    actionableApprovals.map((item) => [item.designId, item.design.priority ?? "MEDIUM"]),
  );

  const recentApprovalQueue = actionableApprovals.slice(0, 8).map((item) => ({
    id: item.designId,
    ideaRef: item.design.ideaRef,
    collectionName: item.design.collectionName,
    status: item.design.status,
    priority: priorityByDesignId.get(item.designId) ?? "MEDIUM",
    updatedAtUtc: new Date().toISOString(),
    currentLevelName: item.currentLevel.name,
  }));

  return {
    approvalPending: actionableApprovals.length,
    highPriorityPending: highPriorityActionable,
    blockedInApproval,
    approvedCount,
    releasedCount,
    underDevelopment,
    liveReviewPending: liveReviewTasks.length,
    liveReviewTasks,
    managementLevelId: managementLevel?.id ?? null,
    recentApprovalQueue,
  };
}
