import { NextResponse } from "next/server";
import { ApiError, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { verifySignedDownloadToken } from "@/lib/signed-download";
import { readStoredObject } from "@/lib/storage";

/**
 * Authenticated + time-limited signed download proxy.
 * Tokens are issued by getPresignedDownloadUrl / signedAppDownloadPath.
 */
export async function GET(request: Request) {
  return withApiHandler(
    [
      PERMISSIONS.DESIGN_CREATE,
      PERMISSIONS.TASK_EXECUTE,
      PERMISSIONS.COST_VIEW,
      PERMISSIONS.PRODUCTION_RELEASE,
      PERMISSIONS.DESIGN_APPROVE,
      PERMISSIONS.MASTER_ADMIN,
    ],
    async () => {
      const token = new URL(request.url).searchParams.get("token");
      if (!token) throw new ApiError("Download token is required", 400);

      const verified = verifySignedDownloadToken(token);
      if (!verified.ok) {
        throw new ApiError(verified.reason, 403);
      }

      const { body, contentType } = await readStoredObject(verified.key);
      const fileName = verified.key.split("/").pop() ?? "download";

      return new NextResponse(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  );
}
