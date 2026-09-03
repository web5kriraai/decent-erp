/**
 * Appends PROD_HANDOFF / PROD_INSTRUCTION / PROD_RELEASE / LIVE_REVIEW to
 * APPROVED designs missing them, then unlocks handoff.
 * Uses the same path as final APPROVED + Production Desk ensure-ladder.
 *
 * Usage: npx tsx scripts/repair-production-stage-tasks.mjs
 */
import { PrismaClient } from "@prisma/client";
import { ensureLadderForApprovedDesigns } from "../src/lib/services/production-handoff-unlock.ts";

const prisma = new PrismaClient();

async function main() {
  const results = await ensureLadderForApprovedDesigns(0, `repair-cli-${Date.now()}`);

  // Update workflow pattern if standard pattern exists
  const pattern = await prisma.workflowPattern.findFirst({
    where: { name: { contains: "Saree", mode: "insensitive" } },
  });

  if (pattern) {
    const roles = await prisma.role.findMany();
    const roleMap = Object.fromEntries(roles.map((r) => [r.code, { id: r.id }]));
    const subs = await prisma.designSubProcessMaster.findMany({
      select: { id: true, code: true, processId: true },
    });
    const subIndex = Object.fromEntries(
      subs.map((s) => [s.code, { id: s.id, processId: s.processId }]),
    );
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
      approvedDesigns: results.length,
      appendedCount: results.filter((r) => r.appended).length,
      unlockedCount: results.filter((r) => r.unlocked).length,
      results,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
