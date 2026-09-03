import { z } from "zod";
import { ApiError, jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { canRoleMarkDesignLive } from "@/lib/action-availability";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listReleasedDesignsForGoLive,
  markDesignLive,
} from "@/lib/services/production-service";

const schema = z.object({
  designId: z.string(),
});

/** Go-live queue — Management/Admin only (matches Mark Live UI). */
export async function GET() {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    if (!canRoleMarkDesignLive(ctx.roleCode)) {
      throw new ApiError(
        "Only Management can view the go-live queue.",
        403,
        undefined,
        APP_ERROR_CODES.PERMISSION_DENIED,
      );
    }
    const designs = await listReleasedDesignsForGoLive();
    return jsonOk(serializeBigInt(designs), ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.PRODUCTION_RELEASE, async (ctx) => {
    const body = await parseBody(request, schema);
    const design = await markDesignLive(BigInt(body.designId), ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
