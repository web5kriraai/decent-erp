import { describe, expect, it } from "vitest";
import {
  getDemoQuickLoginOptions,
  isDemoQuickLoginEnabled,
} from "@/lib/demo-quick-login";

describe("demo-quick-login", () => {
  it("lists seeded demo roles with *@decent-erp.local emails", () => {
    const options = getDemoQuickLoginOptions();
    const labels = options.map((o) => o.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "Design Head",
        "Sketch",
        "Punch",
        "Checker",
        "Machine",
        "Costing",
        "Production",
        "Management",
        "Admin",
      ]),
    );

    for (const option of options) {
      expect(option.email).toMatch(/@decent-erp\.local$/);
      expect(option.password.length).toBeGreaterThanOrEqual(8);
    }

    const sketch = options.find((o) => o.label === "Sketch");
    expect(sketch?.email).toBe("sketch@decent-erp.local");
    expect(sketch?.password).toBe("Demo@123");

    const admin = options.find((o) => o.label === "Admin");
    expect(admin?.email).toBe("admin@decent-erp.local");
    expect(admin?.password).toBe("Admin@123");
  });

  it("is enabled outside production unless flag overrides", () => {
    // NODE_ENV in vitest is typically "test" (non-production)
    expect(isDemoQuickLoginEnabled()).toBe(true);
  });
});
