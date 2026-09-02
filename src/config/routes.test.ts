import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import { getVisibleNavSections } from "@/config/routes";

function sectionIds(roleCode: string) {
  const permissions = DEFAULT_ROLE_PERMISSIONS[roleCode] ?? [];
  return getVisibleNavSections(permissions, roleCode).map((s) => s.id);
}

function allItemIds(roleCode: string) {
  const permissions = DEFAULT_ROLE_PERMISSIONS[roleCode] ?? [];
  return getVisibleNavSections(permissions, roleCode).flatMap((s) => s.items.map((i) => i.id));
}

describe("getVisibleNavSections", () => {
  it("trims New Concept and nested report children from the catalog", () => {
    const ids = allItemIds(ROLE_CODES.ADMIN);
    expect(ids).not.toContain("designs-new");
    expect(ids).not.toContain("reports-corrections");
    expect(ids).not.toContain("reports-design-success");
    expect(ids).toContain("reports-hub");
    expect(ids).toContain("designs-list");
  });

  it("orders Design Head sections by navFocus after Main", () => {
    expect(sectionIds(ROLE_CODES.DESIGN_HEAD)).toEqual([
      "main",
      "my-work",
      "design-pipeline",
      "quality",
      "finance",
      "team-reports",
    ]);
  });

  it("keeps Machine Operator nav short: Main + My Work", () => {
    expect(sectionIds(ROLE_CODES.MACHINE_OPERATOR)).toEqual(["main", "my-work"]);
    expect(allItemIds(ROLE_CODES.MACHINE_OPERATOR)).toEqual(["dashboard", "work-tasks", "work-time"]);
  });

  it("puts System Admin last for Admin and keeps slimmed reports", () => {
    const ids = sectionIds(ROLE_CODES.ADMIN);
    expect(ids[0]).toBe("main");
    expect(ids[ids.length - 1]).toBe("admin");
    expect(allItemIds(ROLE_CODES.ADMIN)).toContain("kpi");
    expect(allItemIds(ROLE_CODES.ADMIN)).toContain("reports-hub");
  });

  it("orders Management by Quality → Finance → Team & Reports → Production", () => {
    expect(sectionIds(ROLE_CODES.MANAGEMENT)).toEqual([
      "main",
      "quality",
      "finance",
      "team-reports",
      "production",
      "my-work",
    ]);
  });

  it("gates Approvals by role hub access for sketch vs checker", () => {
    expect(allItemIds(ROLE_CODES.SKETCH_DESIGNER)).not.toContain("approvals");
    expect(allItemIds(ROLE_CODES.SAMPLE_CHECKER)).toContain("approvals");
  });
});
