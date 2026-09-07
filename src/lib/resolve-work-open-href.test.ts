import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import { resolveWorkOpenHref } from "@/lib/resolve-work-open-href";

describe("resolveWorkOpenHref", () => {
  it("prefers task detail when taskId is known for work intent", () => {
    expect(
      resolveWorkOpenHref({
        taskId: "42",
        designId: "99",
        intent: "task",
      }),
    ).toBe(ROUTES.work.taskDetail("42"));
  });

  it("opens design detail for design browse intent", () => {
    expect(
      resolveWorkOpenHref({
        taskId: "42",
        designId: "99",
        intent: "design",
      }),
    ).toBe(ROUTES.designs.detail("99"));
  });

  it("falls back to design when taskId missing", () => {
    expect(resolveWorkOpenHref({ designId: "99", intent: "work" })).toBe(
      ROUTES.designs.detail("99"),
    );
  });

  it("returns null when nothing provided", () => {
    expect(resolveWorkOpenHref({})).toBeNull();
  });
});
