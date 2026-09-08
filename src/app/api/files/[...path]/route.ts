import { NextResponse } from "next/server";
import { withApiHandler, ApiError } from "@/lib/api-utils";
import { readLocalObject } from "@/lib/local-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Any authenticated user who can open design detail may load stored media.
  return withApiHandler(null, async () => {
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
