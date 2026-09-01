import { describe, expect, it } from "vitest";
import { formatProductionReleaseMissing } from "./production-workflow";

describe("formatProductionReleaseMissing", () => {
  it("formats missing items for user display", () => {
    const text = formatProductionReleaseMissing(["Costing", "Sketch approval"]);
    expect(text).toContain("Production release is not available yet");
    expect(text).toContain("Costing");
    expect(text).toContain("Sketch approval");
  });
});
