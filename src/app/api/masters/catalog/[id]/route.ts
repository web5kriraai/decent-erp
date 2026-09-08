import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  getMasterCatalogById,
  toLegacyActiveShape,
  updateMasterCatalog,
} from "@/lib/services/master-catalog-service";
import { getCatalogUsage } from "@/lib/services/master-usage-service";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await context.params;
    const catalogId = Number(id);
    if (!Number.isInteger(catalogId)) throw new ApiError("Invalid id", 400);
    const row = await getMasterCatalogById(catalogId);
    return jsonOk(serializeBigInt(toLegacyActiveShape(row)), ctx.correlationId);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const catalogId = Number(id);
    if (!Number.isInteger(catalogId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await getMasterCatalogById(catalogId);
    const nextActive = body.isActive ?? body.active;
    const deactivating = nextActive === false && existing.isActive === true;
    const warnings = deactivating ? await getCatalogUsage(catalogId) : [];

    const updated = await updateMasterCatalog(catalogId, {
      name: body.name,
      description: body.description,
      sortOrder: body.sortOrder,
      isActive: nextActive,
    });

    await writeAuditLogDirect({
      entityType: "MasterCatalog",
      entityId: String(catalogId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(
      {
        ...serializeBigInt(toLegacyActiveShape(updated)),
        warnings,
      },
      ctx.correlationId,
    );
  });
}
