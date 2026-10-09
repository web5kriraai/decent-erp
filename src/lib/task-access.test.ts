import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import { decideWorkTaskAccess } from "@/lib/task-access";

describe("decideWorkTaskAccess", () => {
  const base = {
    permissions: [PERMISSIONS.TASK_EXECUTE],
    employeeId: 3,
    companyId: 1,
    taskCompanyId: 1,
    assignedEmployeeId: 3,
  };

  it("allows the assigned employee in the same company", () => {
    expect(decideWorkTaskAccess(base)).toBe("ok");
  });

  it("hides a task from another company", () => {
    expect(decideWorkTaskAccess({ ...base, taskCompanyId: 2 })).toBe("hidden");
  });

  it("refuses another employee's task even with team time or admin permissions", () => {
    expect(
      decideWorkTaskAccess({
        ...base,
        employeeId: 1,
        assignedEmployeeId: 3,
        permissions: [
          PERMISSIONS.TASK_EXECUTE,
          PERMISSIONS.TIME_VIEW_TEAM,
          PERMISSIONS.MASTER_ADMIN,
        ],
      }),
    ).toBe("not-assigned");
  });

  it("refuses a caller who cannot execute tasks", () => {
    expect(
      decideWorkTaskAccess({
        ...base,
        permissions: [PERMISSIONS.TIME_VIEW_TEAM],
      }),
    ).toBe("forbidden");
  });

  it("refuses an unassigned task", () => {
    expect(decideWorkTaskAccess({ ...base, assignedEmployeeId: null })).toBe("not-assigned");
  });
});
