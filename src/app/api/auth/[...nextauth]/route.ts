import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { rewriteProxiedAuthResponse } from "@/lib/public-origin";

async function withPublicOrigin(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>,
) {
  const response = await handler(request);
  return rewriteProxiedAuthResponse(request, response);
}

export function GET(request: NextRequest) {
  return withPublicOrigin(request, handlers.GET);
}

export function POST(request: NextRequest) {
  return withPublicOrigin(request, handlers.POST);
}
