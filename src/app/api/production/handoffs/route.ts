import { ApiError, jsonError, jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { canViewErpChain, ERP_CHAIN_VIEW_PERMISSIONS } from "@/lib/erp-rbac";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listProductionHandoffs,
  syncProductionHandoff,
} from "@/lib/services/erp-handoff-service";
import { permissionDeniedMessage } from "@/lib/user-messages";

/**
 * List / retry ERP handoffs — aligned with Production Desk ERP ops UI (canViewErpChain).
 * Requires PRODUCTION_RELEASE and at least one ERP operate permission.
 */
export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    if (!canViewErpChain(ctx.permissions)) {
      throw new ApiError(
        permissionDeniedMessage(ERP_CHAIN_VIEW_PERMISSIONS),
        403,
        { requiredPermissions: ERP_CHAIN_VIEW_PERMISSIONS },
        APP_ERROR_CODES.PERMISSION_DENIED,
      );
    }
    const designId = new URL(request.url).searchParams.get("designId");
    const handoffs = await listProductionHandoffs(designId ? BigInt(designId) : undefined);
    return jsonOk(serializeBigInt(handoffs), ctx.correlationId);
  });
}

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
    const body = (await request.json()) as { handoffId?: string };
    if (!body.handoffId) {
      return jsonError("handoffId required", 400, ctx.correlationId);
    }
    const handoff = await syncProductionHandoff(
      BigInt(body.handoffId),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(handoff), ctx.correlationId);
  });
}
