import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-utils";
import { resolveCreateDesignHeadEmployeeId } from "@/lib/services/design-service";

describe("resolveCreateDesignHeadEmployeeId", () => {
  it("uses explicit Design Head when provided", () => {
    expect(
      resolveCreateDesignHeadEmployeeId({
        requestedId: 42,
        sessionEmployeeId: 7,
        sessionRoleCode: "ADMIN",
      }),
    ).toBe(42);
  });

  it("defaults Design Head session to self when omitted", () => {
    expect(
      resolveCreateDesignHeadEmployeeId({
        sessionEmployeeId: 7,
        sessionRoleCode: "DESIGN_HEAD",
      }),
    ).toBe(7);
  });

  it("requires a pick for Admin when omitted", () => {
    expect(() =>
      resolveCreateDesignHeadEmployeeId({
        sessionEmployeeId: 1,
        sessionRoleCode: "ADMIN",
      }),
    ).toThrow(ApiError);
  });
});
