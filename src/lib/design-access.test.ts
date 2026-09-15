import { describe, expect, it } from "vitest";
import {
  canListDesigns,
  DESIGN_LIST_VIEW_PERMISSIONS,
  PERMISSIONS,
} from "@/lib/permissions";

describe("design list access", () => {
  it("allows pipeline roles to list designs", () => {
    expect(canListDesigns([PERMISSIONS.DESIGN_CREATE])).toBe(true);
    expect(canListDesigns([PERMISSIONS.COST_VIEW])).toBe(true);
    expect(canListDesigns([PERMISSIONS.PRODUCTION_RELEASE])).toBe(true);
  });

  it("does not allow TASK_EXECUTE alone to list all designs", () => {
    expect(canListDesigns([PERMISSIONS.TASK_EXECUTE])).toBe(false);
    expect(DESIGN_LIST_VIEW_PERMISSIONS).not.toContain(PERMISSIONS.TASK_EXECUTE);
  });
});
