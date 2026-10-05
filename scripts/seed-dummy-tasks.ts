/**
 * Seed dummy DesignTask rows so they show under My Tasks / Action Center.
 *
 * Prerequisites: DB migrated + seeded (`npm run db:seed`).
 *
 * Usage (from decent-erp/):
 *   npx tsx scripts/seed-dummy-tasks.ts
 *   npx tsx scripts/seed-dummy-tasks.ts --email sketch@decent-erp.local --count 5
 *   npx tsx scripts/seed-dummy-tasks.ts --all-demo --count 3
 *
 * My Tasks only lists ASSIGNED / RUNNING / ON_HOLD / CHECKING / CORRECTION_REQUIRED
 * (not PENDING). This script uses those statuses and sets assignedEmployeeId.
 */
import type { Priority, TaskStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";

const DEFAULT_EMAIL = "sketch@decent-erp.local";
const DEFAULT_COUNT = 5;

const MY_TASKS_STATUSES: TaskStatus[] = [
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "CORRECTION_REQUIRED",
];

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** Preferred stage codes per role (falls back to any active sub-process). */
const STAGES_BY_ROLE: Record<string, string[]> = {
  SKETCH_DESIGNER: ["SKETCH", "CORRECTION"],
  DESIGN_HEAD: ["CONCEPT_REVIEW", "SKETCH_APPROVAL", "MAT_REQ", "FINAL_APPROVAL"],
  PUNCHING_DESIGNER: ["PUNCH"],
  MACHINE_OPERATOR: [
    "MACHINE_SAMPLE",
    "SAMPLE_CUTTING",
    "SAMPLE_STITCHING",
    "SAMPLE_RECEIVE",
    "RESAMPLE",
  ],
  SAMPLE_CHECKER: ["PUNCH_CHECK", "SAMPLE_CHECK"],
  COSTING_TEAM: ["COSTING"],
  PRODUCTION_HEAD: ["FABRIC_ISSUE", "PROD_INSTRUCTION", "PROD_RELEASE"],
  MANAGEMENT: ["LIVE_REVIEW"],
  ADMIN: ["CONCEPT_REVIEW", "SKETCH", "COSTING"],
};

const DEMO_EMAILS = [
  "designhead@decent-erp.local",
  "sketch@decent-erp.local",
  "punch@decent-erp.local",
  "machine@decent-erp.local",
  "checker@decent-erp.local",
  "costing@decent-erp.local",
  "production@decent-erp.local",
  "management@decent-erp.local",
];

function parseArgs(argv: string[]) {
  let email = DEFAULT_EMAIL;
  let count = DEFAULT_COUNT;
  let allDemo = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email" && argv[i + 1]) {
      email = argv[++i]!;
    } else if (arg === "--count" && argv[i + 1]) {
      count = Math.max(1, Number(argv[++i]) || DEFAULT_COUNT);
    } else if (arg === "--all-demo") {
      allDemo = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  npx tsx scripts/seed-dummy-tasks.ts [--email EMAIL] [--count N]
  npx tsx scripts/seed-dummy-tasks.ts --all-demo [--count N]

Defaults: --email ${DEFAULT_EMAIL} --count ${DEFAULT_COUNT}`);
      process.exit(0);
    }
  }

  return { email, count, allDemo };
}

async function resolveStagesForRole(roleCode: string) {
  const preferred = STAGES_BY_ROLE[roleCode] ?? [];
  const subs = await prisma.designSubProcessMaster.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      processId: true,
      defaultRoleId: true,
      name: true,
    },
    orderBy: [{ processId: "asc" }, { sequence: "asc" }],
  });

  if (subs.length === 0) {
    throw new Error("No active sub-process masters found. Run npm run db:seed first.");
  }

  const byCode = new Map(subs.map((s) => [s.code, s]));
  const picked = preferred
    .map((code) => byCode.get(code))
    .filter((s): s is (typeof subs)[number] => !!s);

  return picked.length > 0 ? picked : subs;
}

async function seedForEmployee(email: string, count: number) {
  const employee = await prisma.employee.findUnique({
    where: { email },
    include: { role: { select: { id: true, code: true, name: true } } },
  });
  if (!employee || !employee.active) {
    throw new Error(`Active employee not found for ${email}`);
  }

  const designHead =
    (await prisma.employee.findFirst({
      where: { role: { code: "DESIGN_HEAD" }, active: true },
      select: { id: true },
    })) ?? employee;

  const productType = await prisma.masterCatalog.findFirst({
    where: { masterType: "PRODUCT_CATEGORY", isActive: true },
    orderBy: { id: "asc" },
  });
  const season = await prisma.masterCatalog.findFirst({
    where: { masterType: "SEASON", isActive: true },
    orderBy: { id: "asc" },
  });
  if (!productType || !season) {
    throw new Error("Missing PRODUCT_CATEGORY or SEASON catalog. Run npm run db:seed first.");
  }

  const stamp = Date.now().toString(36).toUpperCase();
  const ideaRef = `IDEA-DUMMY-${employee.employeeCode}-${stamp}`;
  const stages = await resolveStagesForRole(employee.role.code);

  const design = await prisma.designConcept.create({
    data: {
      ideaRef,
      designNumber: `DN-DUMMY-${stamp}`,
      companyId: employee.companyId,
      locationId: employee.locationId,
      productTypeId: productType.id,
      collectionName: "Dummy Tasks Collection",
      seasonId: season.id,
      designHeadEmployeeId: designHead.id,
      priority: "MEDIUM",
      conceptNote: `Dummy design for My Tasks seed (${email})`,
      createdById: employee.id,
      status: "ACTIVE",
      currentStage: stages[0]?.code ?? "SKETCH",
      workType: "NEW_DESIGN",
    },
  });

  const rows = Array.from({ length: count }, (_, i) => {
    const stage = stages[i % stages.length]!;
    const status = MY_TASKS_STATUSES[i % MY_TASKS_STATUSES.length]!;
    const priority = PRIORITIES[i % PRIORITIES.length]!;
    const now = new Date();
    return {
      designId: design.id,
      processId: stage.processId,
      subProcessId: stage.id,
      assignedEmployeeId: employee.id,
      assignedRoleId: stage.defaultRoleId ?? employee.roleId,
      status,
      priority,
      expectedMinutes: 60 + i * 15,
      sequence: i + 1,
      dependencySequence: null as number | null,
      startedAt:
        status === "RUNNING" || status === "CHECKING" || status === "CORRECTION_REQUIRED"
          ? new Date(now.getTime() - 60 * 60 * 1000)
          : null,
      dueAt: new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
    };
  });

  await prisma.designTask.createMany({ data: rows });

  console.log(`\n${employee.name} <${email}> (${employee.role.name})`);
  console.log(`  Design: ${ideaRef}`);
  console.log(`  Tasks:  ${count}`);
  for (const row of rows) {
    const stage = stages.find((s) => s.id === row.subProcessId);
    console.log(`    • ${stage?.code ?? "?"}  ${row.status}  ${row.priority}`);
  }

  return { designId: design.id, taskCount: count };
}

async function main() {
  const { email, count, allDemo } = parseArgs(process.argv.slice(2));
  const targets = allDemo ? DEMO_EMAILS : [email];

  console.log(
    allDemo
      ? `Seeding ${count} dummy task(s) for each demo user…`
      : `Seeding ${count} dummy task(s) for ${email}…`,
  );

  let total = 0;
  for (const target of targets) {
    try {
      const result = await seedForEmployee(target, count);
      total += result.taskCount;
    } catch (err) {
      console.error(`  ! skipped ${target}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. Created ${total} task(s).`);
  console.log("Sign in as that user and open My Tasks / Action Center.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
