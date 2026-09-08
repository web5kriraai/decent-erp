import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  countMasterCatalogByType,
  createMasterCatalog,
  listMasterCatalog,
  toLegacyActiveShape,
} from "@/lib/services/master-catalog-service";

const createSchema = z.object({
  masterType: z.string().min(1).max(50),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(5000).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const url = new URL(request.url);
    const includeInactive =
      ctx.permissions.includes(PERMISSIONS.MASTER_ADMIN) &&
      url.searchParams.get("includeInactive") === "1";

    if (url.searchParams.get("summary") === "1") {
      const counts = await countMasterCatalogByType({ includeInactive });
      return jsonOk(counts, ctx.correlationId);
    }

    const masterType = url.searchParams.get("masterType") ?? undefined;
    const rows = await listMasterCatalog({ masterType, includeInactive });
    return jsonOk(
      serializeBigInt(rows.map(toLegacyActiveShape)),
      ctx.correlationId,
    );
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const created = await createMasterCatalog(body);
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
