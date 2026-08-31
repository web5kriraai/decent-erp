import { z } from "zod";
import {
  jsonOk,
  parseBody,
  serializeBigInt,
  withApiHandler,
} from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignById, updateDesign } from "@/lib/services/design-service";

const patchSchema = z.object({
  collectionName: z.string().min(1).optional(),
  conceptNote: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  version: z.number().int().positive(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await params;
    const design = await getDesignById(BigInt(id));
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const design = await updateDesign(
      BigInt(id),
      body,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
