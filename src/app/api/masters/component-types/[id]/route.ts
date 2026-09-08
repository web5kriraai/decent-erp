import { createLegacyCatalogItemHandlers } from "@/lib/services/legacy-catalog-route";
import { MASTER_TYPES } from "@/lib/master-catalog-types";

const handlers = createLegacyCatalogItemHandlers(MASTER_TYPES.PRODUCT_COMPONENT);
export const PATCH = handlers.PATCH;
