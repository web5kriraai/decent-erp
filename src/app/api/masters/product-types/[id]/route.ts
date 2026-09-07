import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  getMasterCatalogById,
  toLegacyActiveShape,
  updateMasterCatalog,
} from "@/lib/services/master-catalog-service";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const catalogId = Number(id);
    if (!Number.isInteger(catalogId)) throw new ApiError("Invalid id", 400);

    const body = await parseBody(request, patchSchema);
    const existing = await getMasterCatalogById(catalogId);
    const updated = await updateMasterCatalog(catalogId, {
      name: body.name,
      description: body.description,
      sortOrder: body.sortOrder,
      isActive: body.isActive ?? body.active,
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

    return jsonOk(serializeBigInt(toLegacyActiveShape(updated)), ctx.correlationId);
  });
}
