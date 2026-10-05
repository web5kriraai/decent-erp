import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { LEGACY_ROUTE_REDIRECTS, ROUTES } from "@/config/routes";
import { publicOriginFrom, rewriteCallbackCookie } from "@/lib/public-origin";

const { auth } = NextAuth(authConfig);

/**
 * ngrok (and other reverse proxies) forward the public host, but Next.js
 * builds redirects from the internal bind address (localhost:3000).
 * Prefer the forwarded host so the browser stays on the public URL.
 */
function redirectTo(request: NextRequest, pathname: string) {
  const origin = publicOriginFrom(request.headers) ?? request.nextUrl.origin;
  return NextResponse.redirect(new URL(pathname, origin));
}

const handleAuth = auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;
  const isLoginPage = pathname.startsWith(ROUTES.login);

  const legacyTarget = LEGACY_ROUTE_REDIRECTS[pathname];
  if (legacyTarget) {
    return redirectTo(request, legacyTarget);
  }

  if (!isLoggedIn && !isLoginPage) {
    return redirectTo(request, ROUTES.login);
  }

  if (isLoggedIn && isLoginPage) {
    return redirectTo(request, ROUTES.dashboard);
  }

  return NextResponse.next();
});

function rewriteLocalhostCallbackCookie(request: NextRequest, response: Response) {
  const origin = publicOriginFrom(request.headers);
  if (!origin || typeof response.headers.getSetCookie !== "function") {
    return response;
  }

  const cookies = response.headers.getSetCookie();
  if (cookies.length === 0) return response;

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    headers.append("set-cookie", rewriteCallbackCookie(cookie, origin));
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function middleware(request: NextRequest) {
  const response = await handleAuth(request);
  if (!response) return response;
  return rewriteLocalhostCallbackCookie(request, response);
}

export const config = {
  // Skip auth for API, Next internals, and any public file with an extension (e.g. /logo.png)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
