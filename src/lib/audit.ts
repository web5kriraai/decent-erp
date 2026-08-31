import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type AuditInput = {
  entityType: string;
  entityId: string;
  action: string;
  userId: number;
  correlationId?: string;
  before?: unknown;
  after?: unknown;
};

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: AuditInput,
) {
  return tx.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      correlationId: input.correlationId,
      beforeJson: input.before ? (input.before as Prisma.InputJsonValue) : undefined,
      afterJson: input.after ? (input.after as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function writeAuditLogDirect(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      correlationId: input.correlationId,
      beforeJson: input.before ? (input.before as Prisma.InputJsonValue) : undefined,
      afterJson: input.after ? (input.after as Prisma.InputJsonValue) : undefined,
    },
  });
}
