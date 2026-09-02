import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createWorkflowPattern,
  getWorkflowPatterns,
} from "@/lib/services/workflow-pattern-service";

const taskSchema = z.object({
  processId: z.number().int().positive(),
  subProcessId: z.number().int().positive(),
  defaultRoleId: z.number().int().positive(),
  expectedMinutes: z.number().int().positive(),
  sequence: z.number().int().positive(),
  dayOffset: z.number().int().nonnegative().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dependencySequence: z.number().int().positive().nullable().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  productTypeId: z.number().int().positive().nullable().optional(),
  versionNo: z.number().int().positive().optional(),
  tasks: z.array(taskSchema).min(1),
});

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const includeInactive =
      ctx.permissions.includes(PERMISSIONS.MASTER_ADMIN) &&
      new URL(request.url).searchParams.get("includeInactive") === "1";
    const patterns = await getWorkflowPatterns({ includeInactive });
    return jsonOk(serializeBigInt(patterns), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const pattern = await createWorkflowPattern(body, ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(pattern), ctx.correlationId, 201);
  });
}
