import { z } from "zod";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ensureErpStagesForReleasedDesigns,
  getErpStagesForDesign,
  listErpStageChains,
} from "@/lib/services/erp-stage-service";

export async function GET(req: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    if (designId) {
      const stages = await getErpStagesForDesign(BigInt(designId));
      return jsonOk(serializeBigInt(stages), ctx.correlationId);
    }
    const chains = await listErpStageChains({ take: 400 });
    return jsonOk(serializeBigInt(chains), ctx.correlationId);
  });
}

const seedBody = z.object({
  backfill: z.boolean().optional(),
});

/** POST { backfill: true } seeds stages for released designs missing them. */
export async function POST(req: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = seedBody.parse(await req.json().catch(() => ({})));
    if (!body.backfill) {
      return jsonOk({ seeded: [] }, ctx.correlationId);
    }
    const seeded = await ensureErpStagesForReleasedDesigns(ctx.employeeId, ctx.correlationId);
    return jsonOk({ seeded }, ctx.correlationId);
  });
}
