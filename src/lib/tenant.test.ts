import { describe, expect, it } from "vitest";
import { assertSameCompany, companyWhere, designTenantWhere } from "@/lib/tenant";
import { ApiError } from "@/lib/errors/api-error";

describe("tenant scoping", () => {
  it("builds company where fragments", () => {
    expect(companyWhere({ companyId: 3 })).toEqual({ companyId: 3 });
    expect(designTenantWhere({ companyId: 7, locationId: 2 })).toEqual({ companyId: 7 });
  });

  it("rejects cross-company access", () => {
    expect(() => assertSameCompany(2, { companyId: 1 }, "Design")).toThrow(ApiError);
  });

  it("allows same company", () => {
    expect(() => assertSameCompany(5, { companyId: 5 })).not.toThrow();
  });
});
