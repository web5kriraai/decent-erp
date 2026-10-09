import { prisma } from "@/lib/db";
import { buildNotificationMessage } from "@/lib/notifications/messages";
import { publishRealtime } from "@/lib/realtime";
import { ROUTES } from "@/config/routes";
import { approvalsHubHrefForRole } from "@/lib/stage-approval-rbac";

function resolveNotificationHref(
  eventType: string,
  payload: Record<string, unknown>,
  roleCode?: string | null,
): string | null {
  if (typeof payload.taskId === "string") {
    if (payload.isStageApproval === true) {
      return approvalsHubHrefForRole(roleCode, "stage");
    }
    return ROUTES.work.taskDetail(payload.taskId);
  }
  if (typeof payload.designId === "string") {
    if (eventType === "APPROVAL_PENDING" || eventType === "DESIGN_APPROVED") {
      return ROUTES.designs.detail(payload.designId);
    }
    return ROUTES.designs.detail(payload.designId);
  }
  if (eventType === "CORRECTION_RAISED") return ROUTES.quality.corrections;
  return null;
}

export async function createEmployeeNotification(
  employeeId: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const { subject, text } = buildNotificationMessage(eventType, payload);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, role: { select: { code: true } } },
  });
  const href = resolveNotificationHref(eventType, payload, employee?.role?.code);

  if (href) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.employeeNotification.findFirst({
      where: { employeeId, eventType, href, createdAtUtc: { gte: since } },
    });
    if (existing) return existing;
  }

  const created = await prisma.employeeNotification.create({
    data: {
      employeeId,
      eventType,
      title: subject,
      body: text,
      href,
    },
  });

  if (employee?.companyId) {
    try {
      await publishRealtime({
        companyId: employee.companyId,
        employeeIds: [employeeId],
        topics: ["notifications"],
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "Notification realtime publish skipped",
          employeeId,
          error: String(error),
        }),
      );
    }
  }

  return created;
}

export async function listEmployeeNotifications(employeeId: number, limit = 20) {
  return prisma.employeeNotification.findMany({
    where: { employeeId },
    orderBy: { createdAtUtc: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(notificationId: bigint, employeeId: number) {
  const row = await prisma.employeeNotification.findFirst({
    where: { id: notificationId, employeeId },
  });
  if (!row) return null;
  if (row.readAtUtc) return row;
  return prisma.employeeNotification.update({
    where: { id: notificationId },
    data: { readAtUtc: new Date() },
  });
}

export async function markAllNotificationsRead(employeeId: number) {
  const result = await prisma.employeeNotification.updateMany({
    where: { employeeId, readAtUtc: null },
    data: { readAtUtc: new Date() },
  });
  return { updated: result.count };
}

export async function countUnreadNotifications(employeeId: number) {
  return prisma.employeeNotification.count({
    where: { employeeId, readAtUtc: null },
  });
}
