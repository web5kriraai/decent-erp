/**
 * Align DesignTask statuses with workflow readiness:
 * - Not-ready ASSIGNED → PENDING (keep assignee)
 * - Ready PENDING with assignee → ASSIGNED
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

const prisma = new PrismaClient();
try {
  const designs = await prisma.designConcept.findMany({ select: { id: true, ideaRef: true } });
  let demoted = 0;
  let promoted = 0;

  for (const design of designs) {
    const tasks = await prisma.designTask.findMany({
      where: { designId: design.id },
      select: {
        id: true,
        status: true,
        sequence: true,
        dependencySequence: true,
        assignedEmployeeId: true,
      },
    });

    for (const task of tasks) {
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
    }),
  );
} finally {
  await prisma.$disconnect();
}
