import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule, notFound } from "@/lib/errors/create-app-error";
import {
  labelForProductionReturnReason,
  PRODUCTION_RETURN_REASON_CODES,
  type ProductionReturnReasonCode,
} from "@/lib/production-return-reasons";
import { raiseCorrectionInTransaction } from "@/lib/services/correction-service";

async function findProdTask(designId: bigint, code: string) {
  return prisma.designTask.findFirst({
    where: { designId, subProcess: { code } },
    include: {
      subProcess: { select: { code: true, name: true } },
      assignedEmployee: { select: { id: true, name: true } },
    },
  });
}

export async function returnProductionForClarification(
  designId: bigint,
  actorId: number,
  input: {
    reasonCode: ProductionReturnReasonCode;
    routeToSubProcessId: number;
    remark?: string;
  },
  correlationId: string,
) {
  if (!PRODUCTION_RETURN_REASON_CODES.includes(input.reasonCode)) {
    throw businessRule(APP_ERROR_CODES.VALIDATION_FAILED, undefined, "Choose a valid return reason.");
  }

  const routeSubProcess = await prisma.designSubProcessMaster.findFirst({
    where: { id: input.routeToSubProcessId, active: true },
  });
  if (!routeSubProcess) {
    throw businessRule(APP_ERROR_CODES.VALIDATION_FAILED, undefined, "Choose a valid route stage.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({
      where: { id: designId },
      include: { designHead: { select: { id: true, name: true } } },
    });
    if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);
    if (design.status !== "APPROVED" && design.status !== "PRODUCTION_ACCEPTED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "Only approved or production-accepted designs can be returned for clarification.",
      );
    }

    const handoff = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_HANDOFF" } },
    });
    if (!handoff || handoff.status !== "COMPLETED") {
      throw businessRule(
        APP_ERROR_CODES.WORKFLOW_NOT_READY,
        undefined,
        "Design Head must complete production handoff before returns apply.",
      );
    }

    const instruction = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_INSTRUCTION" } },
    });
    const release = await tx.designTask.findFirst({
      where: { designId, subProcess: { code: "PROD_RELEASE" } },
    });

    if (release?.status === "COMPLETED") {
      throw businessRule(
        APP_ERROR_CODES.DESIGN_STATUS_INVALID,
        undefined,
        "This design is already released — returns are not allowed after release.",
      );
    }

    const sourceTask = instruction ?? handoff;

    if (instruction && instruction.status === "COMPLETED") {
      throw businessRule(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        undefined,
        "Production instruction is already complete — use return only before acceptance finishes.",
      );
    }

    if (instruction) {
      await tx.designTask.update({
        where: { id: instruction.id },
        data: {
          status: "PENDING",
          assignedEmployeeId: null,
          version: { increment: 1 },
        },
      });
    }

    if (release && ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"].includes(release.status)) {
      await tx.designTask.update({
        where: { id: release.id },
        data: {
          status: "PENDING",
          assignedEmployeeId: null,
          version: { increment: 1 },
        },
      });
    }

    const reasonLabel = labelForProductionReturnReason(input.reasonCode);
    const rootCause = [
      `Production return: ${reasonLabel}`,
      input.remark?.trim() ? input.remark.trim() : null,
      `Route to: ${routeSubProcess.name}`,
    ]
      .filter(Boolean)
      .join("\n");

    const correction = await raiseCorrectionInTransaction(
      tx,
      {
        designId,
        taskId: sourceTask.id,
        correctionType: "OTHER",
        routeToSubProcessId: input.routeToSubProcessId,
        rootCause,
      },
      actorId,
      correlationId,
    );

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "PRODUCTION_RETURN",
      userId: actorId,
      correlationId,
      after: {
        reasonCode: input.reasonCode,
        routeToSubProcessId: input.routeToSubProcessId,
        correctionId: correction.id.toString(),
      },
    });

    return {
      correctionId: correction.id.toString(),
      designHeadId: design.designHead.id,
      routedSubProcessCode: routeSubProcess.code,
      ideaRef: design.ideaRef,
    };
  });

  await enqueueOutboxAndNotify(
    "PRODUCTION_RETURN_CLARIFICATION",
    {
      designId: designId.toString(),
      ideaRef: result.ideaRef,
      reasonCode: input.reasonCode,
      routeToSubProcessId: input.routeToSubProcessId,
      designHeadId: result.designHeadId,
      correctionId: result.correctionId,
    },
    correlationId,
  );

  return result;
}

export async function getProductionReturnOptions(designId: bigint) {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: { id: true, status: true, ideaRef: true },
  });
  if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);

  const subProcesses = await prisma.designSubProcessMaster.findMany({
    where: {
      active: true,
      code: {
        in: [
          "SKETCH",
          "PUNCH",
          "MACHINE_SAMPLE",
          "SAMPLE_CHECK",
          "COSTING",
          "PROD_HANDOFF",
          "MAT_REQ",
          "FABRIC_ISSUE",
        ],
      },
    },
    orderBy: { sequence: "asc" },
    select: { id: true, code: true, name: true },
  });

  const handoff = await findProdTask(designId, "PROD_HANDOFF");
  const instruction = await findProdTask(designId, "PROD_INSTRUCTION");
  const release = await findProdTask(designId, "PROD_RELEASE");

  const canReturn =
    (design.status === "APPROVED" || design.status === "PRODUCTION_ACCEPTED") &&
    handoff?.status === "COMPLETED" &&
    release?.status !== "COMPLETED";

  return {
    designId: design.id.toString(),
    ideaRef: design.ideaRef,
    canReturn,
    reasons: PRODUCTION_RETURN_REASON_CODES.map((code) => ({
      code,
      label: labelForProductionReturnReason(code),
    })),
    routeOptions: subProcesses,
    instructionStatus: instruction?.status ?? null,
  };
}
