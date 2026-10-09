import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  createMasterCatalog,
  listMasterCatalog,
  toLegacyActiveShape,
} from "@/lib/services/master-catalog-service";
import { listComponentMastersForProductCategory } from "@/lib/services/product-category-component-service";
import { MASTER_TYPES } from "@/lib/master-catalog-types";

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const url = new URL(request.url);
    const includeInactive =
      ctx.permissions.includes(PERMISSIONS.MASTER_ADMIN) &&
      url.searchParams.get("includeInactive") === "1";
    const productCategoryIdRaw = url.searchParams.get("productCategoryId");
    const productTypeIdRaw = url.searchParams.get("productTypeId");

    const categoryIdStr = productCategoryIdRaw ?? productTypeIdRaw;
    if (categoryIdStr) {
      const productCategoryId = Number(categoryIdStr);
      if (!Number.isInteger(productCategoryId) || productCategoryId <= 0) {
        throw new ApiError("Invalid productCategoryId", 400);
      }
      const rows = await listComponentMastersForProductCategory({
        productCategoryId,
        includeInactive,
      });
      return jsonOk(serializeBigInt(rows.map(toLegacyActiveShape)), ctx.correlationId);
    }

    const rows = await listMasterCatalog({
      masterType: MASTER_TYPES.PRODUCT_COMPONENT,
      includeInactive,
    });
    return jsonOk(serializeBigInt(rows.map(toLegacyActiveShape)), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const created = await createMasterCatalog({
      ...body,
      masterType: MASTER_TYPES.PRODUCT_COMPONENT,
    });
    await writeAuditLogDirect({
      entityType: "MasterCatalog",
      entityId: String(created.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: created,
    });
    return jsonOk(serializeBigInt(toLegacyActiveShape(created)), ctx.correlationId, 201);
  });
}
