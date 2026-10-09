import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { assertCanReadDesign } from "@/lib/design-access";
import { hasWorkflowHistoryPermission } from "@/lib/permissions";
import { listDesignHistory } from "@/lib/services/design-history-service";
import { ApiError } from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    if (!hasWorkflowHistoryPermission(ctx.permissions)) {
      throw new ApiError("You do not have permission to view design history", 403);
    }

    const { id } = await params;
    const designId = BigInt(id);
    await assertCanReadDesign({
      designId,
      employeeId: ctx.employeeId,
      permissions: ctx.permissions,
      companyId: ctx.companyId,
    });

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const result = await listDesignHistory(designId, { limit, offset });
    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
