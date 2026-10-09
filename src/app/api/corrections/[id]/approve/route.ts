import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { hasCorrectionApprovePermission } from "@/lib/permissions";
import { approveCorrection } from "@/lib/services/correction-service";
import { ApiError } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    if (!hasCorrectionApprovePermission(ctx.permissions)) {
      throw new ApiError("You do not have permission to approve corrections", 403);
    }
    const { id } = await params;
    const correction = await approveCorrection(
      BigInt(id),
      ctx.employeeId,
      ctx.permissions,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId);
  });
}
