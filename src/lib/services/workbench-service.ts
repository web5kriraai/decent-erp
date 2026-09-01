import { prisma } from "@/lib/db";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";

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
  };
}

export async function getManagementWorkbenchSummary() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const managementLevel = await prisma.approvalLevel.findFirst({
    where: { code: "MANAGEMENT_APPROVAL", active: true },
  });

  const [
    approvalPending,
    highPriorityPending,
    blockedInApproval,
    approvedCount,
    releasedCount,
    underDevelopment,
    recentApprovalQueue,
    liveReviewTasks,
  ] = await Promise.all([
    prisma.designConcept.count({ where: { status: "APPROVAL_PENDING" } }),
    prisma.designConcept.count({
      where: { status: "APPROVAL_PENDING", priority: { in: ["HIGH", "URGENT"] } },
    }),
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
    prisma.designConcept.findMany({
      where: { status: "APPROVAL_PENDING" },
      orderBy: [{ priority: "desc" }, { updatedAtUtc: "asc" }],
      take: 8,
      select: {
        id: true,
        ideaRef: true,
        collectionName: true,
        status: true,
        priority: true,
        updatedAtUtc: true,
      },
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

  return {
    approvalPending,
    highPriorityPending,
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
