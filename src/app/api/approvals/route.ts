import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getApprovalLevels,
  listDesignsReadyForSignOff,
  listPendingApprovalsForEmployee,
  submitApproval,
} from "@/lib/services/approval-service";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";

const schema = z.object({
  designId: z.string(),
  taskId: z.string().optional(),
  approvalLevelId: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECTED", "CORRECTION_REQUIRED", "SKIPPED"]),
  remark: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  if (view === "levels") {
    return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
      const levels = await getApprovalLevels();
      return jsonOk(levels, ctx.correlationId);
    });
  }

  if (view === "stage") {
    return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
      const stage = await listStageApprovalQueue(ctx.employeeId);
      return jsonOk(stage, ctx.correlationId);
    });
  }

  if (view === "ready") {
    return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
      const ready = await listDesignsReadyForSignOff(ctx.employeeId);
      return jsonOk(ready, ctx.correlationId);
    });
  }

  if (view === "hub") {
    return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
      const [stageApprovals, managementApprovals, readyForSignOff] = await Promise.all([
        listStageApprovalQueue(ctx.employeeId),
        listPendingApprovalsForEmployee(ctx.employeeId),
        listDesignsReadyForSignOff(ctx.employeeId),
      ]);
      return jsonOk(
        serializeBigInt({ stageApprovals, managementApprovals, readyForSignOff }),
        ctx.correlationId,
      );
    });
  }

  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const pending = await listPendingApprovalsForEmployee(ctx.employeeId);
    return jsonOk(serializeBigInt(pending), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const body = await parseBody(request, schema);
    const approval = await submitApproval(
      {
        designId: BigInt(body.designId),
        taskId: body.taskId ? BigInt(body.taskId) : undefined,
        approvalLevelId: body.approvalLevelId,
        decision: body.decision,
        remark: body.remark,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(approval), ctx.correlationId, 201);
  });
}
