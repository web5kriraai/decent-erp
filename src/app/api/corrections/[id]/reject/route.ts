import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { hasCorrectionApprovePermission, hasCorrectionRequestPermission } from "@/lib/permissions";
import { rejectCorrection } from "@/lib/services/correction-service";
import { ApiError } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    if (
      !hasCorrectionApprovePermission(ctx.permissions) &&
      !hasCorrectionRequestPermission(ctx.permissions)
    ) {
      throw new ApiError("You do not have permission to reject corrections", 403);
    }
    const { id } = await params;
    const correction = await rejectCorrection(
      BigInt(id),
      ctx.employeeId,
      ctx.permissions,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId);
  });
}
