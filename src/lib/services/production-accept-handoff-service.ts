import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule, notFound } from "@/lib/errors/create-app-error";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";
import { validateProductionReleaseReadiness } from "@/lib/services/production-release-readiness";

export async function acceptProductionHandoff(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  const readiness = await validateProductionReleaseReadiness(designId);
  const missing = readiness.missing.filter(
    (item) =>
      !item.toLowerCase().includes("production instruction") &&
      !item.toLowerCase().includes("production release"),
  );
  if (missing.length > 0) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_NOT_READY,
      { missing },
      `Production handoff cannot be accepted yet. Missing: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({
      where: { id: designId },
      select: { id: true, ideaRef: true, status: true, designHeadEmployeeId: true },
    });
    if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
    if (design.status !== "APPROVED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "Only approved designs awaiting production can be accepted.",
      );
    }

    const handoff = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_HANDOFF" } },
      include: { subProcess: { select: { name: true } } },
    });
    if (!handoff || handoff.status !== "COMPLETED") {
      throw businessRule(
        APP_ERROR_CODES.WORKFLOW_NOT_READY,
        undefined,
        "Design Head must complete production handoff before acceptance.",
      );
    }

    const instruction = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_INSTRUCTION" } },
    });
    if (!instruction) {
      throw businessRule(APP_ERROR_CODES.WORKFLOW_NOT_READY, undefined, "Production instruction task is missing.");
    }

    if (instruction.status === "COMPLETED") {
      return { designId: designId.toString(), instructionTaskId: instruction.id.toString(), alreadyAccepted: true };
    }

    if (!["PENDING", "ASSIGNED"].includes(instruction.status)) {
      throw businessRule(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        { status: instruction.status },
        "Production instruction is already in progress.",
      );
    }

    let assigneeId = instruction.assignedEmployeeId ?? actorId;
    if (!instruction.assignedEmployeeId) {
      assigneeId = (await resolveEmployeeForRole(instruction.assignedRoleId)) ?? actorId;
    }

    const updated = await tx.designTask.update({
      where: { id: instruction.id },
      data: {
        status: "ASSIGNED",
        assignedEmployeeId: assigneeId,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "PRODUCTION_HANDOFF_ACCEPTED",
      userId: actorId,
      correlationId,
      after: { instructionTaskId: instruction.id.toString(), assigneeId },
    });

    if (assigneeId != null) {
      await enqueueOutboxAndNotify(
        "PRODUCTION_HANDOFF_ACCEPTED",
        {
          designId: designId.toString(),
          ideaRef: design.ideaRef,
          employeeId: assigneeId,
          taskId: instruction.id.toString(),
        },
        correlationId,
      );
    }

    return {
      designId: designId.toString(),
      instructionTaskId: updated.id.toString(),
      alreadyAccepted: false,
    };
  });
}
