import { prisma } from "@/lib/db";

const DEFAULT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? 365);
const BATCH_SIZE = Number(process.env.AUDIT_ARCHIVE_BATCH_SIZE ?? 500);

export async function archiveAuditLogsOlderThan(
  retentionDays = DEFAULT_RETENTION_DAYS,
): Promise<{ archived: number; cutoffIso: string }> {
  const cutoff = new Date(Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60_000);
  let archived = 0;

  for (;;) {
    const batch = await prisma.auditLog.findMany({
      where: { atUtc: { lt: cutoff } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    await prisma.$transaction(async (tx) => {
      await tx.auditLogArchive.createMany({
        data: batch.map((row) => ({
          sourceAuditId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          action: row.action,
          beforeJson: row.beforeJson ?? undefined,
          afterJson: row.afterJson ?? undefined,
          userId: row.userId,
          atUtc: row.atUtc,
          correlationId: row.correlationId,
        })),
        skipDuplicates: true,
      });
      await tx.auditLog.deleteMany({
        where: { id: { in: batch.map((r) => r.id) } },
      });
    });

    archived += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return { archived, cutoffIso: cutoff.toISOString() };
}

export function auditRetentionDays(): number {
  return Math.max(1, Number(process.env.AUDIT_RETENTION_DAYS ?? 365));
}
