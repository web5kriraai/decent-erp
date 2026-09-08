import { describe, expect, it } from "vitest";
import { masterDisplayName } from "@/lib/master-display";

describe("masterDisplayName", () => {
  it("prefers trimmed name when present", () => {
    expect(masterDisplayName("  Saree  ", "SAREE")).toBe("Saree");
  });

  it("humanizes code when name is missing or blank", () => {
    expect(masterDisplayName(null, "SAREE")).toBe("Saree");
    expect(masterDisplayName("", "KURTI")).toBe("Kurti");
    expect(masterDisplayName("   ", "AUTUMN_WINTER")).toBe("Autumn Winter");
  });

  it("returns fallback when both name and code are absent", () => {
    expect(masterDisplayName(null, null)).toBe("—");
    expect(masterDisplayName(undefined, "", "n/a")).toBe("n/a");
  });
});
