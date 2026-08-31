/**
 * Resets in-progress tasks left over from prior e2e runs so timer tests start clean.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const active = await prisma.designTask.findMany({
    where: { status: { in: ["RUNNING", "ON_HOLD"] } },
    select: { id: true },
  });

  if (active.length > 0) {
    const ids = active.map((t) => t.id);
    await prisma.taskTimeEvent.deleteMany({ where: { taskId: { in: ids } } });
    await prisma.designTask.updateMany({
      where: { id: { in: ids } },
      data: { status: "ASSIGNED", version: { increment: 1 } },
    });
    console.log(`[reset-e2e-task-state] Reset ${active.length} active task(s).`);
  }
} finally {
  await prisma.$disconnect();
}
