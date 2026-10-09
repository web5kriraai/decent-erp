import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createAssignmentRule,
  listAssignmentRules,
  updateAssignmentRule,
} from "@/lib/services/assignment-rule-service";

const createSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
  strategy: z.string().optional(),
  criteriaJson: z
    .object({
      productTypeId: z.number().int().optional(),
      skillId: z.number().int().optional(),
      preferredEmployeeId: z.number().int().optional(),
      subProcessCode: z.string().optional(),
    })
    .optional(),
});

const patchSchema = createSchema.partial().extend({
  id: z.number().int().positive(),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const rules = await listAssignmentRules(ctx.companyId);
    return jsonOk(serializeBigInt(rules), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const rule = await createAssignmentRule(ctx.companyId, body);
    return jsonOk(serializeBigInt(rule), ctx.correlationId, 201);
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, patchSchema);
    const { id, ...rest } = body;
    const rule = await updateAssignmentRule(id, ctx.companyId, rest);
    return jsonOk(serializeBigInt(rule), ctx.correlationId);
  });
}
