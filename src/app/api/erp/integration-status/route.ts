import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  DOWNSTREAM_ERP_MODULES,
  ERP_MODULE_SYNC_ORDER,
  erpSyncOrderMessage,
  getErpIntegrationMode,
  PRIMARY_ERP_MODULES,
} from "@/lib/services/erp-integration-config";

export async function GET() {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const mode = getErpIntegrationMode();
    return jsonOk(
      {
        mode,
        baseUrlConfigured: mode === "live",
        primaryModules: [...PRIMARY_ERP_MODULES],
        downstreamModules: [...DOWNSTREAM_ERP_MODULES],
        syncOrder: [...ERP_MODULE_SYNC_ORDER],
        message: erpSyncOrderMessage(mode),
      },
      ctx.correlationId,
    );
  });
}
