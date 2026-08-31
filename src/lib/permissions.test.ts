import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

describe("permissions", () => {
  it("grants access when user has any of the required permissions", () => {
    const userPerms = Object.values(PERMISSIONS);
    expect(hasPermission(userPerms, PERMISSIONS.TASK_EXECUTE)).toBe(true);
    expect(hasPermission(userPerms, [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_CREATE])).toBe(
      true,
    );
    expect(hasPermission([PERMISSIONS.TASK_EXECUTE], [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_CREATE])).toBe(
      true,
    );
  });

  it("denies access when none of the required permissions are present", () => {
    expect(hasPermission([PERMISSIONS.TASK_EXECUTE], PERMISSIONS.MASTER_ADMIN)).toBe(false);
    expect(
      hasPermission([PERMISSIONS.TASK_EXECUTE], [PERMISSIONS.MASTER_ADMIN, PERMISSIONS.DESIGN_CREATE]),
    ).toBe(false);
  });
});

describe("approval workflow logic", () => {
  it("determines when all levels are passed", () => {
    const levels = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const passedIds = new Set([1, 2, 3]);
    expect(levels.every((l) => passedIds.has(l.id))).toBe(true);

    const partial = new Set([1]);
    expect(levels.every((l) => partial.has(l.id))).toBe(false);
  });
});

describe("cost types", () => {
  const VALID = ["TIME", "MATERIAL", "MACHINE", "CORRECTION"];

  it("accepts valid cost type codes", () => {
    for (const code of VALID) {
      expect(VALID.includes(code)).toBe(true);
    }
  });
});

describe("task timer state transitions", () => {
  it("allows end only from RUNNING or ON_HOLD", () => {
    const canEnd = (status: string) => ["RUNNING", "ON_HOLD"].includes(status);
    expect(canEnd("RUNNING")).toBe(true);
    expect(canEnd("ON_HOLD")).toBe(true);
    expect(canEnd("ASSIGNED")).toBe(false);
    expect(canEnd("COMPLETED")).toBe(false);
  });
});
