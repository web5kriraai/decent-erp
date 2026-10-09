import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import {
  hasCorrectionRequestPermission,
  PERMISSIONS,
} from "@/lib/permissions";
import { ApiError } from "@/lib/api-utils";
import { createCorrection, listCorrections } from "@/lib/services/correction-service";
import type { CorrectionStatus } from "@prisma/client";

const CORRECTION_TYPES = [
  "MISTAKE",
  "IMPROVEMENT",
  "CUSTOMER_CHANGE",
  "MACHINE",
  "MATERIAL",
  "OTHER",
] as const;

const createSchema = z
  .object({
    designId: z.string(),
    taskId: z.string(),
    correctionType: z.enum(CORRECTION_TYPES),
    responsibleEmployeeId: z.number().int().positive().optional().nullable(),
    routeToSubProcessId: z.number().int().positive().optional().nullable(),
    rootCause: z.string().min(1),
    extraMinutes: z.number().int().min(0).optional().nullable(),
    extraCost: z.number().nonnegative().optional().nullable(),
  })
  .superRefine((body, ctx) => {
    if (body.correctionType === "MISTAKE" && !body.responsibleEmployeeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Responsible employee is required for mistake corrections",
        path: ["responsibleEmployeeId"],
      });
    }
  });

const STATUS_VALUES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING", "DONE", "REJECTED"] as const;

export async function GET(request: Request) {
  return withApiHandler(null, async (ctx) => {
    if (
      !hasCorrectionRequestPermission(ctx.permissions) &&
      !ctx.permissions.includes(PERMISSIONS.CORRECTION_EXECUTE)
    ) {
      throw new ApiError("You do not have permission to view corrections", 403);
    }

    const url = new URL(request.url);
    const designId = url.searchParams.get("designId");
    const status = url.searchParams.get("status") as CorrectionStatus | null;
    const reviewerInbox = url.searchParams.get("reviewerInbox") === "true";

    const corrections = await listCorrections({
      employeeId: ctx.employeeId,
      designId: designId ? BigInt(designId) : undefined,
      status: status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
        ? status
        : undefined,
      reviewerInbox,
    });

    return jsonOk(serializeBigInt(corrections), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(null, async (ctx) => {
    if (!hasCorrectionRequestPermission(ctx.permissions)) {
      throw new ApiError("You do not have permission to raise corrections", 403);
    }
    const body = await parseBody(request, createSchema);
    const correction = await createCorrection(
      {
        designId: BigInt(body.designId),
        taskId: BigInt(body.taskId),
        correctionType: body.correctionType,
        responsibleEmployeeId: body.responsibleEmployeeId,
        routeToSubProcessId: body.routeToSubProcessId ?? null,
        rootCause: body.rootCause,
        extraMinutes: body.extraMinutes ?? undefined,
        extraCost: body.extraCost ?? undefined,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId, 201);
  });
}
