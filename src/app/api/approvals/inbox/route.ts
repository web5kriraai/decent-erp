import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { filterManagementApprovalsForRole } from "@/lib/approval-hub-rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listPendingApprovals } from "@/lib/services/approval-service";
import { listStageApprovalQueue } from "@/lib/services/stage-approval-queue";
import {
  canRoleAccessApprovalsHub,
  filterStageApprovalsForRole,
} from "@/lib/stage-approval-rbac";

const HUB_PERMISSION = [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_APPROVE] as const;

/** Master-spec alias: consolidated approval inbox for the current user. */
export async function GET() {
  return withApiHandler([...HUB_PERMISSION], async (ctx) => {
    if (!canRoleAccessApprovalsHub(ctx.roleCode)) {
      return jsonOk({ stage: [], management: [] }, ctx.correlationId);
    }

    const [stageRaw, managementRaw] = await Promise.all([
      listStageApprovalQueue(ctx.employeeId, ctx.roleCode),
      listPendingApprovals(),
    ]);

    const stage = filterStageApprovalsForRole(ctx.roleCode, stageRaw);
    const management = filterManagementApprovalsForRole(ctx.roleCode, managementRaw);

    return jsonOk(serializeBigInt({ stage, management }), ctx.correlationId);
  });
}
