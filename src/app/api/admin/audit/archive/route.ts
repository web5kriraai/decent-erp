import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  archiveAuditLogsOlderThan,
  auditRetentionDays,
} from "@/lib/services/audit-archive-service";

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(
      request,
      z.object({
        retentionDays: z.number().int().min(30).max(3650).optional(),
      }),
    );
    const result = await archiveAuditLogsOlderThan(
      body.retentionDays ?? auditRetentionDays(),
    );
    return jsonOk(result, ctx.correlationId);
  });
}
