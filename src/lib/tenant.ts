import { ApiError } from "@/lib/errors/api-error";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";

/** Session / API context fields used for company isolation. */
export type TenantScope = {
  companyId: number;
  locationId: number | null;
};

export function companyWhere(scope: TenantScope | { companyId: number }) {
  return { companyId: scope.companyId };
}

/** Prisma where fragment for designs visible to the caller's company. */
export function designTenantWhere(scope: TenantScope | { companyId: number }) {
  return { companyId: scope.companyId };
}

/** Prisma where fragment for employees in the caller's company. */
export function employeeTenantWhere(scope: TenantScope | { companyId: number }) {
  return { companyId: scope.companyId };
}

export function assertSameCompany(
  resourceCompanyId: number | null | undefined,
  scope: TenantScope | { companyId: number },
  entityLabel = "Resource",
) {
  if (resourceCompanyId == null) {
    throw new ApiError(
      `${entityLabel} has no company scope`,
      403,
      undefined,
      APP_ERROR_CODES.PERMISSION_DENIED,
    );
  }
  if (resourceCompanyId !== scope.companyId) {
    throw new ApiError(
      `${entityLabel} is outside your company scope`,
      403,
      undefined,
      APP_ERROR_CODES.PERMISSION_DENIED,
    );
  }
}

/** Default company seeded for single-tenant installs and demos. */
export const DEFAULT_COMPANY_CODE = "DECENT";
export const DEFAULT_LOCATION_CODE = "HO";
