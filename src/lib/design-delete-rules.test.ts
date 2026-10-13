import { describe, expect, it } from "vitest";
import { canOfferDesignDelete } from "@/lib/design-delete-rules";

const design = { status: "ACTIVE", createdById: 2, designHeadEmployeeId: 5 };

describe("canOfferDesignDelete", () => {
  it("offers delete to the creator with DESIGN_CREATE", () => {
    expect(canOfferDesignDelete({ employeeId: 2, permissions: ["DESIGN_CREATE"] }, design)).toBe(true);
  });

  it("hides delete without DESIGN_CREATE, even for an admin or the design head", () => {
    expect(canOfferDesignDelete({ employeeId: 9, permissions: ["MASTER_ADMIN"] }, design)).toBe(false);
    expect(canOfferDesignDelete({ employeeId: 5, permissions: [] }, design)).toBe(false);
  });

  it("hides delete from non-owners and on statuses that cannot be deleted", () => {
    expect(canOfferDesignDelete({ employeeId: 9, permissions: ["DESIGN_CREATE"] }, design)).toBe(false);
    expect(
      canOfferDesignDelete({ employeeId: 2, permissions: ["DESIGN_CREATE"] }, { ...design, status: "LIVE" }),
    ).toBe(false);
    expect(canOfferDesignDelete(null, design)).toBe(false);
  });
});
