import { NextResponse } from "next/server";
import { withApiHandler, ApiError } from "@/lib/api-utils";
import { readLocalObject } from "@/lib/local-storage";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TASK_EXECUTE],
    async () => {
      const { path: segments } = await params;
      if (!segments?.length) {
        throw new ApiError("File path is required", 400);
      }

      const key = segments.map((segment) => decodeURIComponent(segment)).join("/");
      const { body, contentType } = await readLocalObject(key);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    },
  );
}
