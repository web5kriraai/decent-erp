import { prisma } from "@/lib/db";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";
import { listPendingApprovalsForEmployee } from "@/lib/services/approval-service";

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
    stageApprovals,
  ] = await Promise.all([
    prisma.designConcept.count({
      where: {
        status: "APPROVAL_PENDING",
        updatedAtUtc: { lt: thirtyDaysAgo },
      },
    }),
    prisma.designConcept.count({
      where: { status: { in: ["APPROVED", "PRODUCTION_ACCEPTED"] } },
    }),
    prisma.designConcept.count({
      where: { status: { in: ["PRODUCTION_RELEASED", "LIVE"] } },
    }),
    prisma.designConcept.count({
      where: { status: { in: ["DRAFT", "ACTIVE", "APPROVAL_PENDING", "ON_HOLD"] } },
    }),
    // Same visibility rules as Approvals hub Stage tab (owner oversee + ready PENDING).
    listStageApprovalQueue(employeeId, "MANAGEMENT"),
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
    managementLevelId: managementLevel?.id ?? null,
    recentApprovalQueue,
  };
}
