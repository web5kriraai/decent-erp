import { withApiHandler, jsonOk, jsonError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Not available in production", 403, ctx.correlationId);
    }

    await seedDatabase();
    return jsonOk({ ok: true, message: "Seed completed" }, ctx.correlationId);
  });
}
