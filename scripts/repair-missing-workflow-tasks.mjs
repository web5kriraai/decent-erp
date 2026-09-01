/**
 * Append missing workflow subprocess tasks to in-flight designs (full master chain).
 * Run: node scripts/repair-missing-workflow-tasks.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FULL_CHAIN = [
  "CONCEPT_REVIEW",
  "SKETCH",
  "SKETCH_APPROVAL",
  "PUNCH",
  "PUNCH_CHECK",
  "MAT_REQ",
  "FABRIC_ISSUE",
  "MACHINE_SAMPLE",
  "SAMPLE_RECEIVE",
  "SAMPLE_CHECK",
  "COSTING",
  "FINAL_APPROVAL",
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
];

async function main() {
  const subs = await prisma.designSubProcessMaster.findMany({
    where: { code: { in: FULL_CHAIN }, active: true },
    include: { process: true },
  });
  const subByCode = Object.fromEntries(subs.map((s) => [s.code, s]));

  const designs = await prisma.designConcept.findMany({
    where: { status: { not: "CLOSED" } },
    select: { id: true, ideaRef: true },
    take: 500,
  });

  let appended = 0;

  for (const design of designs) {
    const existing = await prisma.designTask.findMany({
      where: { designId: design.id },
      select: { subProcess: { select: { code: true } }, sequence: true, dependencySequence: true },
    });
    const existingCodes = new Set(existing.map((t) => t.subProcess.code));
    const maxSeq = Math.max(0, ...existing.map((t) => t.sequence));
    const maxDep = Math.max(0, ...existing.map((t) => t.dependencySequence ?? t.sequence));

    let seq = maxSeq;
    let dep = maxDep;

    for (const code of FULL_CHAIN) {
      if (existingCodes.has(code)) continue;
      const sub = subByCode[code];
      if (!sub) continue;

      seq += 1;
      dep += 1;

      await prisma.designTask.create({
        data: {
          designId: design.id,
          processId: sub.processId,
          subProcessId: sub.id,
          assignedRoleId: sub.defaultRoleId ?? 1,
          status: "PENDING",
          priority: "MEDIUM",
          expectedMinutes: 60,
          sequence: seq,
          dependencySequence: dep,
        },
      });
      appended += 1;
      console.log(`+ ${design.ideaRef}: ${code}`);
    }
  }

  console.log(`Done. Appended ${appended} task(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
