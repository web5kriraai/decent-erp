import { z } from "zod";
import { ApiError, jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  createMasterCatalog,
  getMasterCatalogById,
  listMasterCatalog,
  toLegacyActiveShape,
  updateMasterCatalog,
} from "@/lib/services/master-catalog-service";
import type { MasterType } from "@/lib/master-catalog-types";

const createSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

/** Thin legacy collection route → master_catalog filtered by type. */
export function createLegacyCatalogCollectionHandlers(masterType: MasterType) {
  return {
    async GET(request: Request) {
      return withApiHandler(null, async (ctx) => {
        const includeInactive =
          ctx.permissions.includes(PERMISSIONS.MASTER_ADMIN) &&
          new URL(request.url).searchParams.get("includeInactive") === "1";
        const rows = await listMasterCatalog({ masterType, includeInactive });
        return jsonOk(serializeBigInt(rows.map(toLegacyActiveShape)), ctx.correlationId);
      });
    },
    async POST(request: Request) {
      return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
        const body = await parseBody(request, createSchema);
        const created = await createMasterCatalog({ ...body, masterType });
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
    },
  };
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

/**
 * Legacy `[id]` PATCH → MasterCatalog.
 * Prefer `PATCH /api/masters/catalog/[id]` for new clients.
 */
export function createLegacyCatalogItemHandlers(expectedMasterType: MasterType) {
  return {
    async PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
      return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
        const { id } = await context.params;
        const catalogId = Number(id);
        if (!Number.isInteger(catalogId)) throw new ApiError("Invalid id", 400);

        const body = await parseBody(request, patchSchema);
        const existing = await getMasterCatalogById(catalogId);
        if (existing.masterType !== expectedMasterType) {
          throw new ApiError(`Expected ${expectedMasterType} catalog row`, 422);
        }
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
    },
  };
}
