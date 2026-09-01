import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
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
    rootCause: z.string().min(1),
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
  return withApiHandler(PERMISSIONS.CORRECTION_RAISE, async (ctx) => {
    const url = new URL(request.url);
    const designId = url.searchParams.get("designId");
    const mine = url.searchParams.get("mine") === "1";
    const status = url.searchParams.get("status") as CorrectionStatus | null;

    const corrections = await listCorrections({
      designId: designId ? BigInt(designId) : undefined,
      responsibleEmployeeId: mine ? ctx.employeeId : undefined,
      status: status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])
        ? status
        : undefined,
    });

    return jsonOk(serializeBigInt(corrections), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.CORRECTION_RAISE, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const correction = await createCorrection(
      {
        designId: BigInt(body.designId),
        taskId: BigInt(body.taskId),
        correctionType: body.correctionType,
        responsibleEmployeeId: body.responsibleEmployeeId,
        rootCause: body.rootCause,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId, 201);
  });
}
