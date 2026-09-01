/**
 * Align DesignTask statuses with workflow readiness:
 * - Not-ready ASSIGNED → PENDING (keep assignee)
 * - Ready PENDING with assignee → ASSIGNED
 * - CHECKING work tasks with no stage-approval gate → COMPLETED
 *
 * Run: npx tsx scripts/repair-task-readiness.mjs
 */
import { PrismaClient } from "@prisma/client";

const SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

function depSeq(t) {
  return t.dependencySequence ?? t.sequence;
}

function isReady(task, siblings) {
  const seq = depSeq(task);
  return siblings.every((s) => {
    if (String(s.id) === String(task.id)) return true;
    if (depSeq(s) >= seq) return true;
    return SATISFIED.has(s.status);
  });
}

function findStageApprovalGate(workTask, siblings) {
  const workSeq = depSeq(workTask);
  const approvalsAfter = siblings
    .filter(
      (s) =>
        s.subProcess?.isApproval &&
        depSeq(s) > workSeq &&
        !SATISFIED.has(s.status) &&
        s.status !== "COMPLETED",
    )
    .sort((a, b) => depSeq(a) - depSeq(b));

  for (const approval of approvalsAfter) {
    const approvalSeq = depSeq(approval);
    const openWorkBetween = siblings.some(
      (s) =>
        !s.subProcess?.isApproval &&
        String(s.id) !== String(workTask.id) &&
        depSeq(s) > workSeq &&
        depSeq(s) < approvalSeq &&
        !SATISFIED.has(s.status),
    );
    if (!openWorkBetween) return approval;
  }
  return null;
}

const prisma = new PrismaClient();
try {
  const designs = await prisma.designConcept.findMany({ select: { id: true, ideaRef: true } });
  let demoted = 0;
  let promoted = 0;
  let completedOrphans = 0;

  for (const design of designs) {
    const tasks = await prisma.designTask.findMany({
      where: { designId: design.id },
      select: {
        id: true,
        status: true,
        sequence: true,
        dependencySequence: true,
        assignedEmployeeId: true,
        subProcess: { select: { isApproval: true } },
      },
    });

    for (const task of tasks) {
      if (
        task.status === "CHECKING" &&
        !task.subProcess?.isApproval &&
        !findStageApprovalGate(task, tasks)
      ) {
        await prisma.designTask.update({
          where: { id: task.id },
          data: { status: "COMPLETED", version: { increment: 1 } },
        });
        completedOrphans += 1;
        task.status = "COMPLETED";
        continue;
      }

      if (["COMPLETED", "CANCELLED", "RUNNING", "ON_HOLD", "CHECKING", "CORRECTION_REQUIRED"].includes(task.status)) {
        continue;
      }

      const ready = isReady(task, tasks);
      if (task.status === "ASSIGNED" && !ready) {
        await prisma.designTask.update({
          where: { id: task.id },
          data: { status: "PENDING", version: { increment: 1 } },
        });
        demoted += 1;
        task.status = "PENDING";
      } else if (task.status === "PENDING" && ready && task.assignedEmployeeId != null) {
        await prisma.designTask.update({
          where: { id: task.id },
          data: { status: "ASSIGNED", version: { increment: 1 } },
        });
        promoted += 1;
        task.status = "ASSIGNED";
      }
    }
  }

  console.log(
    JSON.stringify({
      designs: designs.length,
      demotedToPending: demoted,
      promotedToAssigned: promoted,
      completedCheckingWithoutGate: completedOrphans,
    }),
  );
} finally {
  await prisma.$disconnect();
}
