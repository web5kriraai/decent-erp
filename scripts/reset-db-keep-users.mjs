/**
 * Fresh operational data — wipe designs, tasks, time, corrections, KPI scores,
 * notifications, and audit history. Keeps employees, roles, permissions, accounts,
 * and master/reference data (processes, patterns, hold reasons, etc.).
 *
 * Usage:
 *   npm run db:fresh                 # wipe + refresh masters, no sample design
 *   npm run db:fresh:sample           # wipe + refresh masters + IDEA-SAMPLE-001
 *   npx tsx scripts/reset-db-keep-users.mjs --help
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const withSample = args.includes("--sample");
const skipReseed = args.includes("--no-reseed");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Fresh database (keep users & masters)

  npm run db:fresh              Wipe design/task data, refresh masters, empty pipeline
  npm run db:fresh:sample       Same + restore demo design IDEA-SAMPLE-001

Options:
  --sample       Re-create sample design after wipe
  --no-reseed    Wipe only (skip master re-seed from seed.ts)
  --help         Show this help

Keeps:  employees, roles, permissions, accounts, product types, seasons,
        processes, workflow patterns, hold reasons, approval levels, KPI defs
Removes: designs, tasks, time events, corrections, approvals, costs, images,
         handoffs, KPI scores, audit logs, notifications, workday sessions
`);
  process.exit(0);
}

/** @type {Array<{ label: string; run: () => Promise<{ count: number }> }>} */
const WIPE_STEPS = [
  { label: "Task checklist results", run: () => prisma.taskChecklistResult.deleteMany() },
  { label: "Task artifacts", run: () => prisma.taskArtifact.deleteMany() },
  { label: "Task time events", run: () => prisma.taskTimeEvent.deleteMany() },
  { label: "Design corrections", run: () => prisma.designCorrection.deleteMany() },
  { label: "Design approvals", run: () => prisma.designApproval.deleteMany() },
  { label: "Design costs", run: () => prisma.designCost.deleteMany() },
  { label: "Design images", run: () => prisma.designImage.deleteMany() },
  { label: "Design components", run: () => prisma.designComponent.deleteMany() },
  { label: "Design sub-processes", run: () => prisma.designSubProcess.deleteMany() },
  { label: "Design processes", run: () => prisma.designProcess.deleteMany() },
  { label: "Design tasks", run: () => prisma.designTask.deleteMany() },
  { label: "Production handoffs", run: () => prisma.productionHandoff.deleteMany() },
  { label: "Design success metrics", run: () => prisma.designSuccessMetric.deleteMany() },
  { label: "Design concepts", run: () => prisma.designConcept.deleteMany() },
  { label: "Workday sessions", run: () => prisma.workdaySession.deleteMany() },
  { label: "Employee KPI scores", run: () => prisma.employeeKpiScore.deleteMany() },
  { label: "Employee notifications", run: () => prisma.employeeNotification.deleteMany() },
  { label: "Audit logs", run: () => prisma.auditLog.deleteMany() },
  { label: "Notification outbox", run: () => prisma.notificationOutbox.deleteMany() },
  { label: "Auth sessions", run: () => prisma.session.deleteMany() },
  { label: "Verification tokens", run: () => prisma.verificationToken.deleteMany() },
];

function renderProgress(current, total, label) {
  const width = 32;
  const ratio = total === 0 ? 1 : current / total;
  const filled = Math.round(ratio * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const pct = String(Math.round(ratio * 100)).padStart(3, " ");
  process.stdout.write(`\r[${bar}] ${pct}% (${current}/${total}) ${label}`.padEnd(72));
}

async function wipeTransactionalData() {
  const total = WIPE_STEPS.length;
  let deletedTotal = 0;

  console.log(`\nWiping ${total} operational tables…\n`);

  for (let i = 0; i < WIPE_STEPS.length; i++) {
    const step = WIPE_STEPS[i];
    renderProgress(i, total, step.label);
    const result = await step.run();
    deletedTotal += result.count;
  }

  renderProgress(total, total, "Done");
  process.stdout.write("\n\n");
  return deletedTotal;
}

async function main() {
  const beforeUsers = await prisma.employee.count();
  const beforeDesigns = await prisma.designConcept.count();
  const beforeTasks = await prisma.designTask.count();

  console.log("═".repeat(60));
  console.log("  Decent ERP — Fresh data (keep users & masters)");
  console.log("═".repeat(60));
  console.log(`  Employees kept:     ${beforeUsers}`);
  console.log(`  Designs to remove:  ${beforeDesigns}`);
  console.log(`  Tasks to remove:    ${beforeTasks}`);
  console.log("═".repeat(60));

  if (beforeUsers === 0) {
    throw new Error("No employees found. Run `npm run db:seed` first.");
  }

  const deletedRows = await wipeTransactionalData();
  console.log(`Removed ${deletedRows} operational row(s).`);

  const afterWipe = {
    employees: await prisma.employee.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    designs: await prisma.designConcept.count(),
    tasks: await prisma.designTask.count(),
  };
  console.log("After wipe:", afterWipe);

  if (!skipReseed) {
    if (withSample) {
      delete process.env.SEED_SKIP_SAMPLE;
      console.log("\nRe-seeding masters + sample design (IDEA-SAMPLE-001)…");
    } else {
      process.env.SEED_SKIP_SAMPLE = "1";
      console.log("\nRe-seeding masters (no sample design)…");
    }

    const { seedDatabase } = await import("../src/lib/seed.ts");
    await seedDatabase();
  } else {
    console.log("\nSkipped master re-seed (--no-reseed).");
  }

  const after = {
    employees: await prisma.employee.count(),
    roles: await prisma.role.count(),
    designs: await prisma.designConcept.count(),
    tasks: await prisma.designTask.count(),
    holdReasons: await prisma.taskHoldReason.count(),
    productTypes: await prisma.productType.count(),
    processes: await prisma.designProcessMaster.count(),
    patterns: await prisma.workflowPattern.count(),
  };

  console.log("\n✓ Fresh database ready:", after);
  console.log("  Users, roles, and permissions were not removed.\n");
}

main()
  .catch((err) => {
    console.error("\n✗ Fresh reset failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
