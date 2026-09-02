import { z } from "zod";
import {
  jsonOk,
  parseBody,
  serializeBigInt,
  withApiHandler,
} from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { createDesignWithTasks, listDesigns } from "@/lib/services/design-service";

const createDesignSchema = z
  .object({
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
  })
  .superRefine((body, ctx) => {
    if (body.assignmentMode === "AUTOMATIC" && !body.workflowPatternId) {
      ctx.addIssue({
        code: "custom",
        path: ["workflowPatternId"],
        message: "Workflow pattern is required for automatic assignment",
      });
    }
    if (
      body.assignmentMode === "MANUAL" &&
      (!body.manualTasks || body.manualTasks.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["manualTasks"],
        message: "At least one manual task is required",
      });
    }
    if (body.assignmentMode === "MANUAL" && body.manualTasks?.length) {
      body.manualTasks.forEach((task, index) => {
        if (!task.processId) {
          ctx.addIssue({
            code: "custom",
            path: ["manualTasks", index, "processId"],
            message: "Process is required",
          });
        }
        if (!task.subProcessId) {
          ctx.addIssue({
            code: "custom",
            path: ["manualTasks", index, "subProcessId"],
            message: "Sub-process is required",
          });
        }
        if (!task.expectedMinutes || task.expectedMinutes <= 0) {
          ctx.addIssue({
            code: "custom",
            path: ["manualTasks", index, "expectedMinutes"],
            message: "Expected minutes must be greater than zero",
          });
        }
      });
    }
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
      ctx.roleCode,
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
