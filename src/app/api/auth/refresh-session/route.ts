import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { loadEmployeeSessionPermissions } from "@/lib/session-permissions";

/** Reload role + permissions from DB and patch the JWT via session.update() on the client. */
export async function POST() {
  return withApiHandler(null, async (ctx) => {
    const fresh = await loadEmployeeSessionPermissions(ctx.employeeId);
    return jsonOk(fresh, ctx.correlationId);
  });
}
