import { prisma } from "@/lib/db";

export async function listDesignHistory(
  designId: bigint,
  options?: { limit?: number; offset?: number },
) {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const [tasks, corrections] = await Promise.all([
    prisma.designTask.findMany({
      where: { designId },
      select: { id: true },
    }),
    prisma.designCorrection.findMany({
      where: { designId },
      select: { id: true },
    }),
  ]);

  const designIdStr = designId.toString();
  const taskIds = tasks.map((t) => t.id.toString());
  const correctionIds = corrections.map((c) => c.id.toString());

  const where = {
    OR: [
      { entityType: "DesignConcept", entityId: designIdStr },
      ...(taskIds.length
        ? [{ entityType: "DesignTask", entityId: { in: taskIds } }]
        : []),
      ...(correctionIds.length
        ? [{ entityType: "DesignCorrection", entityId: { in: correctionIds } }]
        : []),
      { entityType: "DesignCost", entityId: designIdStr },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, employeeCode: true } },
      },
      orderBy: { atUtc: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}
