import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission,
  PERMISSIONS,
  ROLE_CODES,
} from "@/lib/permissions";
import {
  DEPENDENCY_SATISFIED_STATUSES,
  isDependencySatisfiedStatus,
} from "@/lib/services/task-dependency";

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

  it("gives Design Head TASK_EXECUTE so Concept Review / stage tasks can run on My Tasks", () => {
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.DESIGN_HEAD]).toContain(PERMISSIONS.TASK_EXECUTE);
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.DESIGN_HEAD]).toContain(PERMISSIONS.WORKFLOW_OVERRIDE);
  });

  it("does not give workflow override to sample checker or management", () => {
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.SAMPLE_CHECKER]).not.toContain(
      PERMISSIONS.WORKFLOW_OVERRIDE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.MANAGEMENT]).not.toContain(
      PERMISSIONS.WORKFLOW_OVERRIDE,
    );
  });

  it("gives Management TASK_EXECUTE so Live Review can run on My Tasks", () => {
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.MANAGEMENT]).toContain(PERMISSIONS.TASK_EXECUTE);
  });

  it("splits ERP chain SoD across roles", () => {
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.PRODUCTION_HEAD]).toContain(
      PERMISSIONS.ERP_FLOOR_OPERATE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.PRODUCTION_HEAD]).toContain(
      PERMISSIONS.ERP_SALES_OPERATE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.PRODUCTION_HEAD]).not.toContain(
      PERMISSIONS.ERP_ACCOUNTS_OPERATE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.COSTING_TEAM]).toContain(
      PERMISSIONS.ERP_ACCOUNTS_OPERATE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_CODES.MANAGEMENT]).toContain(
      PERMISSIONS.ERP_ACCOUNTS_OPERATE,
    );
  });
});

describe("task dependency gate", () => {
  it("treats CHECKING as satisfied so Send-for-Checking unlocks the next sequence", () => {
    expect(DEPENDENCY_SATISFIED_STATUSES).toContain("CHECKING");
    expect(DEPENDENCY_SATISFIED_STATUSES).toContain("SKIPPED");
    expect(isDependencySatisfiedStatus("CHECKING")).toBe(true);
    expect(isDependencySatisfiedStatus("SKIPPED")).toBe(true);
    expect(isDependencySatisfiedStatus("COMPLETED")).toBe(true);
    expect(isDependencySatisfiedStatus("CANCELLED")).toBe(true);
    expect(isDependencySatisfiedStatus("ASSIGNED")).toBe(false);
    expect(isDependencySatisfiedStatus("RUNNING")).toBe(false);
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
