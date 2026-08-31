import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LEGACY_ROUTE_REDIRECTS, ROUTES } from "@/config/routes";

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
