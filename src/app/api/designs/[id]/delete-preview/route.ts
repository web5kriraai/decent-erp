import { jsonOk, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCanReadDesign } from "@/lib/design-access";
import { getDesignDeleteEligibility } from "@/lib/services/design-delete-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const designId = BigInt(id);
    await assertCanReadDesign({
      designId,
      employeeId: ctx.employeeId,
      permissions: ctx.permissions,
      companyId: ctx.companyId,
    });
    const eligibility = await getDesignDeleteEligibility(designId, ctx.companyId, {
      employeeId: ctx.employeeId,
      permissions: ctx.permissions,
    });
    return jsonOk(eligibility, ctx.correlationId);
  });
}
