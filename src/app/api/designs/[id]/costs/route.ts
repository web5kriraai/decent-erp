import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  addCostEntry,
  getCostSummary,
  listDesignCosts,
} from "@/lib/services/costing-service";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  costType: z.enum(["TIME", "MATERIAL", "MACHINE", "CORRECTION"]),
  description: z.string().optional(),
  amount: z.number().positive(),
});

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.COST_VIEW, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const designId = BigInt(id);
    const [costs, summary] = await Promise.all([
      listDesignCosts(designId),
      getCostSummary(designId),
    ]);
    return jsonOk(serializeBigInt({ costs, summary }), ctx.correlationId);
  });
}

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.COST_VIEW, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const body = await parseBody(request, createSchema);
    const cost = await addCostEntry(
      BigInt(id),
      body,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(cost), ctx.correlationId, 201);
  });
}
