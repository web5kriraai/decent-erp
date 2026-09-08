import { prisma } from "../src/lib/db";
import {
  ensureGlobalConceptTargetForPeriod,
  getConceptTargetAttainment,
} from "../src/lib/services/concept-target-service";

async function main() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const admin = await prisma.employee.findFirst({
    where: { email: "admin@decent-erp.local" },
  });
  if (!admin) throw new Error("NO_ADMIN");
  await ensureGlobalConceptTargetForPeriod({
    year,
    month,
    targetCount: 10,
    createdById: admin.id,
    note: "Repair current-month concept target",
  });
  const attainment = await getConceptTargetAttainment({ year, month });
  console.log(JSON.stringify(attainment, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
