import { prisma } from "@/lib/db";
import { buildNotificationMessage } from "@/lib/notifications/messages";
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
    select: { role: { select: { code: true } } },
  });
  const href = resolveNotificationHref(eventType, payload, employee?.role?.code);

  return prisma.employeeNotification.create({
    data: {
      employeeId,
      eventType,
      title: subject,
      body: text,
      href,
    },
  });
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
  return prisma.employeeNotification.update({
    where: { id: notificationId },
    data: { readAtUtc: new Date() },
  });
}

export async function countUnreadNotifications(employeeId: number) {
  return prisma.employeeNotification.count({
    where: { employeeId, readAtUtc: null },
  });
}
