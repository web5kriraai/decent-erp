/**
 * Wipe transactional business data; keep employees, accounts, roles, permissions,
 * and master/reference data. Re-seed masters (idempotent) + optional sample design.
 *
 * Usage:
 *   npm run db:reset:users              # keep masters, no sample design
 *   npm run db:reset:users -- --sample  # also restore IDEA-SAMPLE-001
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const withSample = process.argv.includes("--sample");

async function wipeTransactionalData() {
  await prisma.taskChecklistResult.deleteMany();
  await prisma.taskArtifact.deleteMany();
  await prisma.taskTimeEvent.deleteMany();
  await prisma.designCorrection.deleteMany();
  await prisma.designApproval.deleteMany();
  await prisma.designCost.deleteMany();
  await prisma.designImage.deleteMany();
  await prisma.designComponent.deleteMany();
  await prisma.designSubProcess.deleteMany();
  await prisma.designProcess.deleteMany();
  await prisma.designTask.deleteMany();
  await prisma.productionHandoff.deleteMany();
  await prisma.designSuccessMetric.deleteMany();
  await prisma.designConcept.deleteMany();
  await prisma.workdaySession.deleteMany();
  await prisma.employeeKpiScore.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notificationOutbox.deleteMany();

  // Force fresh login; keep Account + Employee
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
}

async function main() {
  const beforeUsers = await prisma.employee.count();
  console.log(
    `[db:reset:users] Keeping ${beforeUsers} employee(s) + masters; wiping designs/tasks/time…`,
  );

  await wipeTransactionalData();

  const remaining = {
    employees: await prisma.employee.count(),
    roles: await prisma.role.count(),
    productTypes: await prisma.productType.count(),
    processes: await prisma.designProcessMaster.count(),
    patterns: await prisma.workflowPattern.count(),
    designs: await prisma.designConcept.count(),
    tasks: await prisma.designTask.count(),
  };
  console.log("[db:reset:users] After wipe:", remaining);

  if (remaining.employees === 0) {
    throw new Error("No employees left — aborting. Run npm run db:seed first.");
  }

  if (withSample) {
    delete process.env.SEED_SKIP_SAMPLE;
    console.log("[db:reset:users] Re-seeding reference data + sample design…");
  } else {
    process.env.SEED_SKIP_SAMPLE = "1";
    console.log("[db:reset:users] Re-seeding reference data (no sample design)…");
  }

  const { seedDatabase } = await import("../src/lib/seed.ts");
  await seedDatabase();

  const after = {
    employees: await prisma.employee.count(),
    designs: await prisma.designConcept.count(),
    tasks: await prisma.designTask.count(),
    holdReasons: await prisma.taskHoldReason.count(),
    productTypes: await prisma.productType.count(),
    processes: await prisma.designProcessMaster.count(),
    patterns: await prisma.workflowPattern.count(),
  };
  console.log("[db:reset:users] Done:", after);
}

main()
  .catch((err) => {
    console.error("[db:reset:users] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
