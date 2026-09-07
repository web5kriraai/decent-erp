import { DEMO_ACCOUNTS, ROLE_CATALOG, type RoleCode } from "@/config/roles";
import { ROLE_CODES } from "@/lib/permissions";

/** Short labels matching R&D demo login role picker. */
const DEMO_QUICK_LOGIN_LABELS: Partial<Record<RoleCode, string>> = {
  [ROLE_CODES.DESIGN_HEAD]: "Design Head",
  [ROLE_CODES.SKETCH_DESIGNER]: "Sketch",
  [ROLE_CODES.PUNCHING_DESIGNER]: "Punch",
  [ROLE_CODES.SAMPLE_CHECKER]: "Checker",
  [ROLE_CODES.MACHINE_OPERATOR]: "Machine",
  [ROLE_CODES.COSTING_TEAM]: "Costing",
  [ROLE_CODES.PRODUCTION_HEAD]: "Production",
  [ROLE_CODES.MANAGEMENT]: "Management",
  [ROLE_CODES.ADMIN]: "Admin",
};

export type DemoQuickLoginOption = {
  label: string;
  email: string;
  password: string;
  role: RoleCode;
};

/**
 * Demo quick-login is on in non-production builds, or when explicitly
 * enabled via NEXT_PUBLIC_DEMO_QUICK_LOGIN=true (even in production).
 */
export function isDemoQuickLoginEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_QUICK_LOGIN === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/** Seeded *@decent-erp.local accounts for UAT / demo sign-in. */
export function getDemoQuickLoginOptions(): DemoQuickLoginOption[] {
  return DEMO_ACCOUNTS.map((account) => {
    const role = account.role as RoleCode;
    return {
      label:
        DEMO_QUICK_LOGIN_LABELS[role] ??
        ROLE_CATALOG[role]?.displayName ??
        role.replace(/_/g, " "),
      email: account.email,
      password: account.password,
      role,
    };
  });
}
