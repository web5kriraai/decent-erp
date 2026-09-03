import { z } from "zod";
import { ApiError, jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { canViewErpChain, ERP_CHAIN_VIEW_PERMISSIONS } from "@/lib/erp-rbac";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { PERMISSIONS } from "@/lib/permissions";
import { syncDesignHandoffs } from "@/lib/services/erp-handoff-service";
import { permissionDeniedMessage } from "@/lib/user-messages";

const schema = z.object({
  designId: z.string().min(1),
});

/** Batch sync — same capability gate as handoff retry (ERP operate + PRODUCTION_RELEASE). */
export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    if (!canViewErpChain(ctx.permissions)) {
      throw new ApiError(
        permissionDeniedMessage(ERP_CHAIN_VIEW_PERMISSIONS),
        403,
        { requiredPermissions: ERP_CHAIN_VIEW_PERMISSIONS },
        APP_ERROR_CODES.PERMISSION_DENIED,
      );
    }
    const body = await parseBody(request, schema);
    const results = await syncDesignHandoffs(
      BigInt(body.designId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(results), ctx.correlationId);
  });
}
