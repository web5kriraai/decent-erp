import { prisma } from "@/lib/db";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";
import { countOpenCorrectionsForEmployee } from "@/lib/services/correction-service";
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
    countOpenCorrectionsForEmployee(designHeadId),
    listStageApprovalQueue(designHeadId, "DESIGN_HEAD"),
    listDesignsReadyForSignOff(designHeadId, "DESIGN_HEAD"),
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

  const readyToMarkLiveWhere = {
    status: "PRODUCTION_RELEASED" as const,
    OR: [
      { tasks: { none: { subProcess: { code: "LIVE_REVIEW" } } } },
      {
        tasks: {
          some: { subProcess: { code: "LIVE_REVIEW" }, status: "COMPLETED" as const },
        },
      },
    ],
  };

  const [
    blockedInApproval,
    approvedCount,
    releasedCount,
    underDevelopment,
    stageApprovals,
    readyToMarkLiveCount,
    readyToMarkLiveRows,
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
    // Same visibility rules as Approvals hub Stage tab (owner oversee + ready PENDING).
    listStageApprovalQueue(employeeId, "MANAGEMENT"),
    prisma.designConcept.count({ where: readyToMarkLiveWhere }),
    prisma.designConcept.findMany({
      where: readyToMarkLiveWhere,
      orderBy: { updatedAtUtc: "desc" },
      take: 8,
      select: {
        id: true,
        ideaRef: true,
        collectionName: true,
        status: true,
      },
    }),
  ]);

  const liveReviewQueue = stageApprovals.filter((item) => item.stageCode === "LIVE_REVIEW");
  const liveReviewTasks = liveReviewQueue.slice(0, 8).map((item) => ({
    id: item.taskId,
    status: item.status,
    design: {
      id: item.designId,
      ideaRef: item.ideaRef,
      collectionName: item.collectionName,
      status: "PRODUCTION_RELEASED",
    },
    subProcess: { name: item.stageName },
  }));

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
    liveReviewPending: liveReviewQueue.length,
    liveReviewTasks,
    readyToMarkLiveCount,
    readyToMarkLive: readyToMarkLiveRows.map((row) => ({
      id: row.id.toString(),
      ideaRef: row.ideaRef,
      collectionName: row.collectionName,
      status: row.status,
    })),
    managementLevelId: managementLevel?.id ?? null,
    recentApprovalQueue,
  };
}
