import { prisma } from "@/lib/db";
import { enqueueOutboxAndNotify } from "@/lib/notifications";

const MATERIAL_HOLD_ROLES = ["PRODUCTION_HEAD"] as const;
const MACHINE_HOLD_ROLES = ["MACHINE_OPERATOR"] as const;

/**
 * Spec §17: on WAIT_MATERIAL / MACHINE_NA hold, notify Design Head + relevant department.
 */
export async function notifyMaterialOrMachineHold(input: {
  taskId: bigint;
  designId: bigint;
  holdReasonCode: string;
  correlationId: string;
}): Promise<void> {
  const { holdReasonCode } = input;
  if (holdReasonCode !== "WAIT_MATERIAL" && holdReasonCode !== "MACHINE_NA") {
    return;
  }

  const eventType = holdReasonCode === "WAIT_MATERIAL" ? "MATERIAL_HOLD" : "MACHINE_HOLD";
  const deptRoles =
    holdReasonCode === "WAIT_MATERIAL" ? MATERIAL_HOLD_ROLES : MACHINE_HOLD_ROLES;

  const design = await prisma.designConcept.findUnique({
    where: { id: input.designId },
    select: { designHeadEmployeeId: true, ideaRef: true },
  });
  if (!design) return;

  const deptEmployees = await prisma.employee.findMany({
    where: { active: true, role: { code: { in: [...deptRoles] } } },
    select: { id: true },
  });

  const recipientIds = new Set<number>([design.designHeadEmployeeId]);
  for (const e of deptEmployees) {
    recipientIds.add(e.id);
  }

  const payloadBase = {
    taskId: input.taskId.toString(),
    designId: input.designId.toString(),
    ideaRef: design.ideaRef,
    holdReasonCode,
  };

  for (const employeeId of recipientIds) {
    await enqueueOutboxAndNotify(
      eventType,
      { ...payloadBase, employeeId },
      input.correlationId,
    );
  }
}
