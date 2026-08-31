import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { requestDesignApproval } from "@/lib/services/approval-service";
import { ApiError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const design = await requestDesignApproval(BigInt(id), ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
