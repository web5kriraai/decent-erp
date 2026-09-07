import { createLegacyCatalogCollectionHandlers } from "@/lib/services/legacy-catalog-route";
import { MASTER_TYPES } from "@/lib/master-catalog-types";

const handlers = createLegacyCatalogCollectionHandlers(MASTER_TYPES.FABRIC_QUALITY);
export const GET = handlers.GET;
export const POST = handlers.POST;
