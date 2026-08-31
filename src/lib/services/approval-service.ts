import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import type { ApprovalDecision } from "@prisma/client";

export async function submitApproval(
  input: {
    designId: bigint;
    taskId?: bigint;
    approvalLevelId: number;
    decision: ApprovalDecision;
    remark?: string;
  },
  approverEmployeeId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.designApproval.findFirst({
      where: {
        designId: input.designId,
        approvalLevelId: input.approvalLevelId,
        decision: "PENDING",
      },
    });
    if (duplicate && input.decision !== "SKIPPED") {
      throw new ApiError("Active approval already exists at this level", 409);
    }

    const approval = await tx.designApproval.create({
      data: {
        designId: input.designId,
        taskId: input.taskId,
        approvalLevelId: input.approvalLevelId,
        approverEmployeeId,
        decision: input.decision,
        remark: input.remark,
        decisionAtUtc: new Date(),
      },
    });

    if (input.decision === "APPROVED") {
      await tx.designConcept.update({
        where: { id: input.designId },
        data: { status: "APPROVED" },
      });
    } else if (input.decision === "REJECTED") {
      await tx.designConcept.update({
        where: { id: input.designId },
        data: { status: "REJECTED" },
      });
    }

    await writeAuditLog(tx, {
      entityType: "DesignApproval",
      entityId: approval.id.toString(),
      action: input.decision,
      userId: approverEmployeeId,
      correlationId,
      after: approval,
    });

    return approval;
  });
}
