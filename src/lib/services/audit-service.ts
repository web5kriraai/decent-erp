import { prisma } from "@/lib/db";

export async function listAuditLogs(filters: {
  entityType?: string;
  entityId?: string;
  userId?: number;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  return prisma.auditLog.findMany({
    where: {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? {
            atUtc: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, employeeCode: true } },
    },
    orderBy: { atUtc: "desc" },
    take: filters.limit ?? 100,
  });
}
