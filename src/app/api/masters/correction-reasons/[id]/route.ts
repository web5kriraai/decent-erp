import { createLegacyCatalogItemHandlers } from "@/lib/services/legacy-catalog-route";
import { MASTER_TYPES } from "@/lib/master-catalog-types";

const handlers = createLegacyCatalogItemHandlers(MASTER_TYPES.CORRECTION_TYPE);
export const PATCH = handlers.PATCH;
