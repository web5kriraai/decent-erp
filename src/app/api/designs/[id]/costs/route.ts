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
  costCategory: z.enum(["FABRIC", "EMBROIDERY", "STITCHING", "SALARY", "OTHER"]).nullable().optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
});

const patchExpectedMrpSchema = z.object({
  expectedMrp: z.number().positive().nullable(),
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

/** Set Expected MRP on the design for R&D cost sheet margin. */
export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.COST_VIEW, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const body = await parseBody(request, patchExpectedMrpSchema);
    const { prisma } = await import("@/lib/db");
    const { writeAuditLogDirect } = await import("@/lib/audit");
    const designId = BigInt(id);
    const before = await prisma.designConcept.findUnique({
      where: { id: designId },
      select: { expectedMrp: true },
    });
    if (!before) throw new ApiError("Design not found", 404);
    const updated = await prisma.designConcept.update({
      where: { id: designId },
      data: { expectedMrp: body.expectedMrp },
      select: { id: true, expectedMrp: true },
    });
    await writeAuditLogDirect({
      entityType: "DesignConcept",
      entityId: id,
      action: "EXPECTED_MRP_UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before,
      after: { expectedMrp: updated.expectedMrp },
    });
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
