import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { PermissionCode } from "./permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeId: number;
      email: string;
      name: string;
      roleCode: string;
      permissions: string[];
      emailVerified?: Date | null;
    };
  }

  interface User {
    employeeId: number;
    roleCode: string;
    permissions: string[];
    emailVerified?: Date | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    employeeId: number;
    roleCode: string;
    permissions: string[];
  }
}

async function loadEmployeePermissions(roleId: number) {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePermissions.map((rp) => rp.permission.code);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const employee = await prisma.employee.findUnique({
          where: { email: String(credentials.email) },
          include: { role: true },
        });

        if (!employee || !employee.active) return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          employee.passwordHash,
        );
        if (!valid) return null;

        const permissions = await loadEmployeePermissions(employee.roleId);

        return {
          id: String(employee.id),
          employeeId: employee.id,
          email: employee.email,
          name: employee.name,
          roleCode: employee.role.code,
          permissions,
          emailVerified: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.employeeId = user.employeeId;
        token.roleCode = user.roleCode;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.sub ?? "",
        employeeId: token.employeeId as number,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        roleCode: token.roleCode as string,
        permissions: (token.permissions as string[]) ?? [],
        emailVerified: null,
      };
      return session;
    },
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) return true;
      return isLoggedIn;
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return null;
  }
  return session;
}

export function requirePermission(
  permissions: string[],
  required: PermissionCode | PermissionCode[],
) {
  const requiredList = Array.isArray(required) ? required : [required];
  // Array = any of (OR). Matches API routes like [DESIGN_CREATE, TASK_EXECUTE].
  return requiredList.some((p) => permissions.includes(p));
}
