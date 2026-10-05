import type { NextAuthConfig } from "next-auth";
import { ROUTES } from "@/config/routes";

/**
 * Edge-safe Auth.js config - no Prisma/DB imports.
 * Used by middleware and merged into the full auth setup in auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: ROUTES.login,
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.employeeId = user.employeeId;
        token.roleCode = user.roleCode;
        token.permissions = user.permissions;
        token.companyId = user.companyId;
        token.locationId = user.locationId;
      }

      // Client calls session.update({ permissions, roleCode }) after /api/auth/refresh-session.
      if (trigger === "update" && session) {
        const patch = session as {
          permissions?: string[];
          roleCode?: string;
          companyId?: number;
          locationId?: number | null;
        };
        if (patch.permissions) token.permissions = patch.permissions;
        if (patch.roleCode) token.roleCode = patch.roleCode;
        if (patch.companyId != null) token.companyId = patch.companyId;
        if (patch.locationId !== undefined) token.locationId = patch.locationId;
      }

      return token;
    },
    session({ session, token }) {
      session.user = {
        id: token.sub ?? "",
        employeeId: token.employeeId as number,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        roleCode: token.roleCode as string,
        permissions: (token.permissions as string[]) ?? [],
        companyId: (token.companyId as number) ?? 0,
        locationId: (token.locationId as number | null) ?? null,
        emailVerified: null,
      };
      return session;
    },
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith(ROUTES.login);
      if (isLoginPage) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
