/**
 * One-shot Option A migration: drain APPROVAL_PENDING → APPROVED when stages+costing OK.
 *
 * Usage (from decent-erp/):
 *   npx tsx scripts/heal-approval-pending.ts
 */
import { prisma } from "../src/lib/db";
import { healApprovalPendingDesigns } from "../src/lib/services/approval-service";

async function main() {
  const admin = await prisma.employee.findFirst({
    where: { role: { code: "ADMIN" }, active: true },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error("No active ADMIN employee found to attribute the heal audit");
  }

  const correlationId = `heal-approval-pending-${Date.now()}`;
  console.log(`Healing APPROVAL_PENDING as ${admin.email} (${correlationId})…`);

  const result = await healApprovalPendingDesigns(correlationId, admin.id);
  console.log(`Healed: ${result.healed.length}`);
  for (const id of result.healed) console.log(`  + ${id}`);
  console.log(`Skipped: ${result.skipped.length}`);
  for (const row of result.skipped) console.log(`  - ${row.designId}: ${row.reason}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
