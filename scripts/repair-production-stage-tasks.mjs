/**
 * Appends PROD_HANDOFF / PROD_INSTRUCTION / PROD_RELEASE tasks to designs
 * that completed the 8-step pattern but lack production stages.
 * Re-seeds workflow pattern tasks for the standard saree pattern.
 *
 * Usage: npx tsx scripts/repair-production-stage-tasks.mjs
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_CODES } from "../src/lib/permissions.ts";
import { appendProductionStageTasks } from "../src/lib/services/production-handoff-unlock.ts";
import { unlockProductionHandoffTask } from "../src/lib/services/production-handoff-unlock.ts";

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, { id: r.id }]));

  const subs = await prisma.designSubProcessMaster.findMany({
    select: { id: true, code: true, processId: true },
  });
  const subIndex = Object.fromEntries(
    subs.map((s) => [s.code, { id: s.id, processId: s.processId }]),
  );

  const approvedDesigns = await prisma.designConcept.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  let appended = 0;
  for (const design of approvedDesigns) {
    await prisma.$transaction(async (tx) => {
      await appendProductionStageTasks(tx, design.id, subIndex, roleMap);
    });
    appended += 1;
  }

  let unlocked = 0;
  for (const design of approvedDesigns) {
    const correlationId = `repair-prod-handoff-${design.id}`;
    await prisma.$transaction(async (tx) => {
      const id = await unlockProductionHandoffTask(tx, design.id, correlationId);
      if (id) unlocked += 1;
    });
  }

  // Update workflow pattern if standard pattern exists
  const pattern = await prisma.workflowPattern.findFirst({
    where: { name: { contains: "Saree", mode: "insensitive" } },
  });

  if (pattern) {
    const { buildStandardWorkflowTasks } = await import("../src/lib/seed/masters-data.ts");
    const workflowTasks = buildStandardWorkflowTasks(roleMap, subIndex);
    await prisma.workflowPatternTask.deleteMany({ where: { workflowPatternId: pattern.id } });
    await prisma.workflowPatternTask.createMany({
      data: workflowTasks.map((t) => ({ workflowPatternId: pattern.id, ...t })),
    });
    console.log(`Updated workflow pattern ${pattern.id} with ${workflowTasks.length} tasks`);
  }

  console.log(
    JSON.stringify({
      approvedDesignsPatched: appended,
      handoffTasksUnlocked: unlocked,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
