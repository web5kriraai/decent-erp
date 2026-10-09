import { z } from "zod";
import {
  jsonOk,
  parseBody,
  serializeBigInt,
  withApiHandler,
} from "@/lib/api-utils";
import { DESIGN_LIST_VIEW_PERMISSIONS } from "@/lib/design-access";
import { createDesignWithTasks, listDesigns } from "@/lib/services/design-service";
import {
  hasAssignAutoPermission,
  hasAssignManualPermission,
  PERMISSIONS,
} from "@/lib/permissions";
import { ApiError } from "@/lib/api-utils";
import { isBeforeToday } from "@/lib/ui/date-input";

const createDesignSchema = z
  .object({
    productTypeId: z.number().int().positive(),
    collectionName: z.string().min(1),
    seasonId: z.number().int().positive(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    conceptNote: z.string().trim().min(1, "Concept note is required"),
    styleName: z.string().optional(),
    workType: z.enum(["NEW_DESIGN", "REPEAT", "REVIVAL", "CUSTOM"]).optional(),
    trendReference: z.string().optional(),
    celebrityReference: z.string().optional(),
    targetGrade: z.string().optional(),
    designGradeId: z.number().int().positive().optional(),
    fabricId: z.number().int().positive().optional(),
    machineId: z.number().int().positive().optional(),
    stitchingTypeId: z.number().int().positive().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    targetEndDate: z.string().min(1).optional(),
    assignmentMode: z.enum(["AUTOMATIC", "MANUAL"]),
    workflowPatternId: z.number().int().optional(),
    taskDateMode: z
      .enum(["SEQUENTIAL", "SAME_DAY"])
      .optional(),
    patternSteps: z
      .array(
        z.object({
          sequence: z.number().int().positive(),
          expectedMinutes: z.number().int().positive(),
          dueAt: z.string().min(1),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
          assignedEmployeeId: z.number().int().positive().optional(),
          instructionNote: z.string().trim().max(2000).optional(),
        }),
      )
      .optional(),
    componentTypeIds: z.array(z.number().int().positive()).optional(),
    componentSpecs: z.record(z.string(), z.string()).optional(),
    manualTasks: z
      .array(
        z.object({
          processId: z.number().int(),
          subProcessId: z.number().int(),
          expectedMinutes: z.number().int().positive(),
          assignedEmployeeId: z.number().int().optional(),
          sequence: z.number().int().optional(),
          dueAt: z.string().min(1).optional(),
          instructionNote: z.string().trim().max(2000).optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        }),
      )
      .optional(),
  })
  .superRefine((body, ctx) => {
    const endDay = body.targetEndDate?.slice(0, 10);
    if (body.targetEndDate) {
      const endDate = new Date(body.targetEndDate);
      if (Number.isNaN(endDate.getTime())) {
        ctx.addIssue({
          code: "custom",
          path: ["targetEndDate"],
          message: "End date is invalid",
        });
      } else if (isBeforeToday(body.targetEndDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["targetEndDate"],
          message: "End date cannot be in the past",
        });
      }
    }
    if (body.assignmentMode === "AUTOMATIC" && !body.workflowPatternId) {
      ctx.addIssue({
        code: "custom",
        path: ["workflowPatternId"],
        message: "Workflow pattern is required for automatic assignment",
      });
    }
    if (body.assignmentMode === "AUTOMATIC" && body.patternSteps?.length) {
      body.patternSteps.forEach((step, index) => {
        const parsed = new Date(step.dueAt);
        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({
            code: "custom",
            path: ["patternSteps", index, "dueAt"],
            message: "Due date is invalid",
          });
        } else if (isBeforeToday(step.dueAt)) {
          ctx.addIssue({
            code: "custom",
            path: ["patternSteps", index, "dueAt"],
            message: "Due date cannot be in the past",
          });
        } else if (endDay && step.dueAt.slice(0, 10) > endDay) {
          ctx.addIssue({
            code: "custom",
            path: ["patternSteps", index, "dueAt"],
            message: "Due date must be on or before the end date",
          });
        }
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
        if (!task.dueAt) {
          ctx.addIssue({
            code: "custom",
            path: ["manualTasks", index, "dueAt"],
            message: "Due date is required",
          });
        } else {
          const parsed = new Date(task.dueAt);
          if (Number.isNaN(parsed.getTime())) {
            ctx.addIssue({
              code: "custom",
              path: ["manualTasks", index, "dueAt"],
              message: "Due date is invalid",
            });
          } else if (isBeforeToday(task.dueAt)) {
            ctx.addIssue({
              code: "custom",
              path: ["manualTasks", index, "dueAt"],
              message: "Due date cannot be in the past",
            });
          } else if (endDay && task.dueAt.slice(0, 10) > endDay) {
            ctx.addIssue({
              code: "custom",
              path: ["manualTasks", index, "dueAt"],
              message: "Due date must be on or before the end date",
            });
          }
        }
        if (!task.priority) {
          ctx.addIssue({
            code: "custom",
            path: ["manualTasks", index, "priority"],
            message: "Priority is required",
          });
        }
      });
    }
  });

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const body = await parseBody(request, createDesignSchema);
    if (body.assignmentMode === "AUTOMATIC" && !hasAssignAutoPermission(ctx.permissions)) {
      throw new ApiError("Automatic workflow assignment is not permitted for your role", 403);
    }
    if (body.assignmentMode === "MANUAL" && !hasAssignManualPermission(ctx.permissions)) {
      throw new ApiError("Manual task assignment is not permitted for your role", 403);
    }
    const design = await createDesignWithTasks(
      {
        ...body,
        designHeadEmployeeId: ctx.employeeId,
      },
      ctx.employeeId,
      ctx.correlationId,
      ctx.roleCode,
      { companyId: ctx.companyId, locationId: ctx.locationId },
    );
    return jsonOk(serializeBigInt(design), ctx.correlationId, 201);
  });
}

export async function GET(request: Request) {
  return withApiHandler(DESIGN_LIST_VIEW_PERMISSIONS, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const result = await listDesigns({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
      companyId: ctx.companyId,
    });
    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
