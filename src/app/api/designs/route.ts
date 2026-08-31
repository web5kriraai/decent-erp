import { z } from "zod";
import {
  jsonOk,
  parseBody,
  serializeBigInt,
  withApiHandler,
} from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { createDesignWithTasks, listDesigns } from "@/lib/services/design-service";

const createDesignSchema = z.object({
  productTypeId: z.number().int().positive(),
  collectionName: z.string().min(1),
  seasonId: z.number().int().positive(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  conceptNote: z.string().optional(),
  styleName: z.string().optional(),
  workType: z.enum(["NEW_DESIGN", "REPEAT", "REVIVAL", "CUSTOM"]).optional(),
  trendReference: z.string().optional(),
  celebrityReference: z.string().optional(),
  targetGrade: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  standardCost: z.number().nonnegative().optional(),
  assignmentMode: z.enum(["AUTOMATIC", "MANUAL"]),
  workflowPatternId: z.number().int().optional(),
  componentTypeIds: z.array(z.number().int().positive()).optional(),
  manualTasks: z
    .array(
      z.object({
        processId: z.number().int(),
        subProcessId: z.number().int(),
        expectedMinutes: z.number().int().positive(),
        assignedEmployeeId: z.number().int().optional(),
        sequence: z.number().int().optional(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const body = await parseBody(request, createDesignSchema);
    const design = await createDesignWithTasks(
      {
        ...body,
        designHeadEmployeeId: ctx.employeeId,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(design), ctx.correlationId, 201);
  });
}

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const result = await listDesigns({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
