import { describe, expect, it } from "vitest";
import {
  correctionRouteCodesFromStages,
  suggestedCorrectionRouteCode,
} from "@/lib/workflow/correction-routes";

describe("correctionRouteCodesFromStages", () => {
  it("returns correction-capable execute stages from a custom pattern", () => {
    const codes = correctionRouteCodesFromStages([
      { code: "BRIEF", name: "Brief", isCorrectionAllowed: true },
      { code: "CAD", name: "CAD", isCorrectionAllowed: true },
      { code: "CAD_REVIEW", name: "CAD Review", isCorrectionAllowed: true, capabilities: { isApproval: true, approvalSurface: "inline_card" } },
      { code: "SHIP", name: "Ship", isCorrectionAllowed: false },
    ]);
    expect(codes).toEqual(["BRIEF", "CAD"]);
  });

  it("falls back to textile defaults when none allowed", () => {
    const codes = correctionRouteCodesFromStages([
      { code: "SHIP", name: "Ship", isCorrectionAllowed: false },
    ]);
    expect(codes).toContain("PUNCH");
    expect(codes).toContain("SKETCH");
  });

  it("suggests precursor for approval source", () => {
    expect(
      suggestedCorrectionRouteCode("SKETCH_APPROVAL", ["SKETCH", "PUNCH", "CAD"]),
    ).toBe("SKETCH");
  });
});
