import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import {
  canControlTask,
  findControllableActiveTask,
  getTimerControlFlags,
} from "@/lib/task-control-capability";

describe("task-control-capability", () => {
  const sketchApproval = {
    status: "RUNNING",
    assignedEmployeeId: 2,
    subProcess: {
      code: "SKETCH_APPROVAL",
      isApproval: true,
      defaultRole: { code: ROLE_CODES.DESIGN_HEAD },
    },
  };

  const sketchWork = {
    status: "RUNNING",
    assignedEmployeeId: 5,
    subProcess: {
      code: "SKETCH",
      isApproval: false,
      defaultRole: { code: ROLE_CODES.SKETCH_DESIGNER },
    },
  };

  it("lets assignee control execute tasks", () => {
    expect(
      canControlTask({
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 5,
        roleCode: ROLE_CODES.SKETCH_DESIGNER,
        task: sketchWork,
      }),
    ).toBe(true);
  });

  it("lets Design Head control assigned-elsewhere stage approval", () => {
    expect(
      canControlTask({
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 9,
        roleCode: ROLE_CODES.DESIGN_HEAD,
        task: sketchApproval,
      }),
    ).toBe(true);
  });

  it("denies non-owner non-assignee", () => {
    expect(
      canControlTask({
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 9,
        roleCode: ROLE_CODES.SKETCH_DESIGNER,
        task: sketchApproval,
      }),
    ).toBe(false);
  });

  it("hides End for stage approval but keeps Hold", () => {
    const flags = getTimerControlFlags(sketchApproval);
    expect(flags.showHold).toBe(true);
    expect(flags.showEnd).toBe(false);
    expect(flags.blocksTimerEnd).toBe(true);
  });

  it("shows Hold+End for execute RUNNING work", () => {
    const flags = getTimerControlFlags(sketchWork);
    expect(flags.showHold).toBe(true);
    expect(flags.showEnd).toBe(true);
  });

  it("finds controllable active task for stage owner", () => {
    const found = findControllableActiveTask(
      [
        { id: "1", ...sketchWork, assignedEmployeeId: 5 },
        { id: "2", ...sketchApproval, assignedEmployeeId: 2 },
      ],
      {
        permissions: [PERMISSIONS.TASK_EXECUTE],
        employeeId: 9,
        roleCode: ROLE_CODES.DESIGN_HEAD,
      },
    );
    expect(found?.id).toBe("2");
  });
});
