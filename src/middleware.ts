import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { LEGACY_ROUTE_REDIRECTS, ROUTES } from "@/config/routes";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;
  const isLoginPage = pathname.startsWith(ROUTES.login);

  const legacyTarget = LEGACY_ROUTE_REDIRECTS[pathname];
  if (legacyTarget) {
    return NextResponse.redirect(new URL(legacyTarget, request.nextUrl));
  }

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL(ROUTES.login, request.nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip auth for API, Next internals, and any public file with an extension (e.g. /logo.png)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
