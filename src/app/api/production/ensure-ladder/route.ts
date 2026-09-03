import { z } from "zod";
import { ApiError, jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { ensureLadderForApprovedDesigns } from "@/lib/services/production-handoff-unlock";

const bodySchema = z.object({
  designId: z
    .string()
    .regex(/^\d+$/, "Invalid design id")
    .optional(),
});

/**
 * POST — append PROD_* ladder + unlock handoff for APPROVED designs missing them
 * (Spec 8-Step / flexible patterns stuck after management approval).
 */
export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const raw = await request.json().catch(() => ({}));
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(raw ?? {});
    } catch {
      throw new ApiError("Invalid design id", 400);
    }
    const results = await ensureLadderForApprovedDesigns(
      ctx.employeeId,
      ctx.correlationId,
      body.designId ? BigInt(body.designId) : undefined,
    );
    return jsonOk(
      {
        results,
        scannedCount: results.length,
        appendedCount: results.filter((r) => r.appended).length,
        unlockedCount: results.filter((r) => r.unlocked).length,
      },
      ctx.correlationId,
    );
  });
}
