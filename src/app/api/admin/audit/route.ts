import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { listAuditLogs } from "@/lib/services/audit-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const logs = await listAuditLogs({
      entityType,
      entityId,
      userId: userId ? Number(userId) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return jsonOk(serializeBigInt(logs), ctx.correlationId);
  });
}
