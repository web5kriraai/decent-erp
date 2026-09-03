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
import {
  canRoleAccessApprovalsHub,
  filterStageApprovalsForRole,
  getApprovalHubTabsForRole,
} from "@/lib/stage-approval-rbac";

const schema = z.object({
  designId: z.string(),
  taskId: z.string().optional(),
  approvalLevelId: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECTED", "CORRECTION_REQUIRED", "SKIPPED"]),
  remark: z.string().optional(),
  correctionType: z
    .enum(["MISTAKE", "IMPROVEMENT", "CUSTOMER_CHANGE", "MACHINE", "MATERIAL", "OTHER"])
    .optional(),
  routeSubProcessCode: z.string().optional(),
  responsibleEmployeeId: z.number().int().positive().optional(),
});

const HUB_PERMISSION = [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_APPROVE] as const;

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
    return withApiHandler([...HUB_PERMISSION], async (ctx) => {
      const stage = await listStageApprovalQueue(ctx.employeeId, ctx.roleCode);
      return jsonOk(stage, ctx.correlationId);
    });
  }

  if (view === "ready") {
    return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
      const ready = await listDesignsReadyForSignOff(ctx.employeeId, ctx.roleCode);
      return jsonOk(ready, ctx.correlationId);
    });
  }

  if (view === "hub") {
    return withApiHandler([...HUB_PERMISSION], async (ctx) => {
      if (!canRoleAccessApprovalsHub(ctx.roleCode)) {
        return jsonOk(
          serializeBigInt({
            stageApprovals: [],
            managementApprovals: [],
            readyForSignOff: [],
            tabs: getApprovalHubTabsForRole(ctx.roleCode),
          }),
          ctx.correlationId,
        );
      }

      const tabs = getApprovalHubTabsForRole(ctx.roleCode);
      const [stageApprovals, managementApprovals, readyForSignOff] = await Promise.all([
        tabs.stage
          ? listStageApprovalQueue(ctx.employeeId, ctx.roleCode)
          : Promise.resolve([]),
        tabs.management
          ? listPendingApprovalsForEmployee(ctx.employeeId)
          : Promise.resolve([]),
        tabs.ready
          ? listDesignsReadyForSignOff(ctx.employeeId, ctx.roleCode)
          : Promise.resolve([]),
      ]);

      return jsonOk(
        serializeBigInt({
          stageApprovals: filterStageApprovalsForRole(ctx.roleCode, stageApprovals),
          managementApprovals,
          readyForSignOff,
          tabs,
        }),
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
        correctionType: body.correctionType,
        routeSubProcessCode: body.routeSubProcessCode,
        responsibleEmployeeId: body.responsibleEmployeeId,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(approval), ctx.correlationId, 201);
  });
}
