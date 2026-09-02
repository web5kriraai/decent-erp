import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignById } from "@/lib/services/design-service";
import { resolveDesignContextActions } from "@/lib/workflow-actions/resolve";
import type { DesignSummary } from "@/lib/types/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withApiHandler(
    [
      PERMISSIONS.DESIGN_CREATE,
      PERMISSIONS.TASK_EXECUTE,
      PERMISSIONS.DESIGN_APPROVE,
      PERMISSIONS.COST_VIEW,
      PERMISSIONS.PRODUCTION_RELEASE,
    ],
    async (ctx) => {
      const design = serializeBigInt(
        await getDesignById(BigInt(id), { viewerEmployeeId: ctx.employeeId }),
      ) as unknown as DesignSummary;
      const actions = resolveDesignContextActions({
        design,
        employeeId: ctx.employeeId,
        permissions: ctx.permissions,
        roleCode: ctx.roleCode,
      });
      return jsonOk({ actions }, ctx.correlationId);
    },
  );
}
