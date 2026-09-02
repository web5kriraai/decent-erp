import { PrismaClient } from "@prisma/client";

const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.MEDIUM;
}

const prisma = new PrismaClient();

async function syncOpenTaskPrioritiesForEmployee(employeeId) {
  const rows = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      priority: true,
      design: { select: { priority: true, collectionName: true } },
    },
  });

  let updated = 0;
  for (const row of rows) {
    const designPriority = row.design.priority;
    if (priorityRank(designPriority) >= priorityRank(row.priority)) continue;
    await prisma.designTask.update({
      where: { id: row.id },
      data: { priority: designPriority },
    });
    updated += 1;
    console.log("updated", row.design.collectionName, row.priority, "->", designPriority);
  }
  return updated;
}

syncOpenTaskPrioritiesForEmployee(3)
  .then((n) => console.log("total updated:", n))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
