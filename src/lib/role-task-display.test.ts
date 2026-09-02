import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "@/config/roles";
import { ROLE_CODES } from "@/lib/permissions";
import {
  categorizeEmployeeTask,
  foldWaitingTaskToPersonalBucket,
  type DepSibling,
  type MyTaskRow,
} from "@/lib/services/action-center";
import { resolveEffectiveTaskStatus } from "@/lib/services/workflow-stage-gate";
import {
  formatActionCenterListHint,
  resolveListItemDisplayStatus,
  shouldApplyWaitingListStyle,
} from "@/lib/task-action-display";

function sibling(
  id: string,
  sequence: number,
  status: string,
  opts: {
    name: string;
    code: string;
    isApproval?: boolean;
    assignee?: string;
  },
): DepSibling {
  return {
    id,
    dependencySequence: sequence,
    sequence,
    status,
    assignedEmployeeId: 1,
    subProcess: { name: opts.name, code: opts.code, isApproval: opts.isApproval ?? false },
    assignedEmployee: { name: opts.assignee ?? "Owner" },
  };
}

function row(id: string, sequence: number, status: string, code: string, isApproval = false): MyTaskRow {
  return {
    id,
    status,
    dependencySequence: sequence,
    sequence,
    subProcess: { name: code, code, isApproval },
    assignedEmployeeId: 1,
  };
}

describe("every demo role — CHECKING display vs effectiveStatus", () => {
  it("covers all seeded demo accounts", () => {
    expect(DEMO_ACCOUNTS.map((a) => a.role).sort()).toEqual(
      [
        ROLE_CODES.ADMIN,
        ROLE_CODES.COSTING_TEAM,
        ROLE_CODES.DESIGN_HEAD,
        ROLE_CODES.MACHINE_OPERATOR,
        ROLE_CODES.MANAGEMENT,
        ROLE_CODES.PRODUCTION_HEAD,
        ROLE_CODES.PUNCHING_DESIGNER,
        ROLE_CODES.SAMPLE_CHECKER,
        ROLE_CODES.SKETCH_DESIGNER,
      ].sort(),
    );
  });

  it("Sketch Designer: CHECKING sketch waiting on approval stays CHECKING on Upcoming", () => {
    const siblings = [
      sibling("1", 1, "COMPLETED", { name: "Concept Review", code: "CONCEPT_REVIEW", isApproval: true }),
      sibling("2", 2, "CHECKING", { name: "Sketch Creation", code: "SKETCH" }),
      sibling("3", 3, "ASSIGNED", {
        name: "Sketch Approval",
        code: "SKETCH_APPROVAL",
        isApproval: true,
        assignee: "Design Head",
      }),
    ];
    const task = row("2", 2, "CHECKING", "SKETCH");
    const effectiveStatus = resolveEffectiveTaskStatus(task, siblings);
    expect(categorizeEmployeeTask(task, siblings)).toBe("waitingForOthers");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("upcoming");
    expect(effectiveStatus).toBe("CHECKING");
    expect(resolveListItemDisplayStatus({ status: task.status, effectiveStatus })).toBe("CHECKING");
    expect(
      formatActionCenterListHint(
        {
          status: task.status,
          effectiveStatus,
          isWaitingOnOthers: true,
          waitingOnAssignee: "Design Head",
          waitingOnStage: "Sketch Approval",
        },
        "upcoming",
      ),
    ).toBe("Submitted · waiting on Design Head (Sketch Approval)");
    expect(shouldApplyWaitingListStyle({ status: task.status, effectiveStatus }, "upcoming")).toBe(true);
  });

  it("Punch Designer: CHECKING punch with no gate is COMPLETED on Completed tab", () => {
    const siblings = [
      sibling("4", 4, "CHECKING", { name: "Punching / Wilcom", code: "PUNCH" }),
      sibling("5", 5, "ASSIGNED", { name: "Machine Sample", code: "MACHINE_SAMPLE" }),
    ];
    const task = row("4", 4, "CHECKING", "PUNCH");
    const effectiveStatus = resolveEffectiveTaskStatus(task, siblings);
    expect(categorizeEmployeeTask(task, siblings)).toBe("completed");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("completed");
    expect(effectiveStatus).toBe("COMPLETED");
    expect(resolveListItemDisplayStatus({ status: "CHECKING", effectiveStatus })).toBe("COMPLETED");
    expect(shouldApplyWaitingListStyle({ status: "CHECKING", effectiveStatus }, "upcoming")).toBe(false);
    expect(
      formatActionCenterListHint(
        { status: "CHECKING", effectiveStatus, isWaitingOnOthers: true },
        "completed",
      ),
    ).toBe("Your stage is done · design continues in pipeline");
  });

  it("Punch Designer: CHECKING punch waiting on punch check stays CHECKING on Upcoming", () => {
    const siblings = [
      sibling("4", 4, "CHECKING", { name: "Punching / Wilcom", code: "PUNCH" }),
      sibling("5", 5, "ASSIGNED", {
        name: "Punching Checking",
        code: "PUNCH_CHECK",
        isApproval: true,
        assignee: "Sample Checker",
      }),
    ];
    const task = row("4", 4, "CHECKING", "PUNCH");
    expect(resolveEffectiveTaskStatus(task, siblings)).toBe("CHECKING");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("upcoming");
  });

  it("Machine Operator: CHECKING machine sample with later sample check is COMPLETED", () => {
    const siblings = [
      sibling("5", 5, "CHECKING", { name: "Machine Sample", code: "MACHINE_SAMPLE" }),
      sibling("6", 6, "ASSIGNED", { name: "Sample Receive", code: "SAMPLE_RECEIVE" }),
      sibling("7", 7, "PENDING", {
        name: "Sample Checking",
        code: "SAMPLE_CHECK",
        isApproval: true,
        assignee: "Sample Checker",
      }),
    ];
    const task = row("5", 5, "CHECKING", "MACHINE_SAMPLE");
    expect(resolveEffectiveTaskStatus(task, siblings)).toBe("COMPLETED");
    expect(categorizeEmployeeTask(task, siblings)).toBe("completed");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("completed");
  });

  it("Sample Checker: CHECKING approval stages keep CHECKING (not rewritten to COMPLETED)", () => {
    const punchCheck = row("5", 5, "CHECKING", "PUNCH_CHECK", true);
    const sampleCheck = row("7", 7, "CHECKING", "SAMPLE_CHECK", true);
    expect(resolveEffectiveTaskStatus(punchCheck, [])).toBe("CHECKING");
    expect(resolveEffectiveTaskStatus(sampleCheck, [])).toBe("CHECKING");
  });

  it("Costing Team: CHECKING costing waiting on final approval stays CHECKING", () => {
    const siblings = [
      sibling("10", 10, "CHECKING", { name: "Costing", code: "COSTING" }),
      sibling("11", 11, "ASSIGNED", {
        name: "Final Approval",
        code: "FINAL_APPROVAL",
        isApproval: true,
        assignee: "Design Head",
      }),
    ];
    const task = row("10", 10, "CHECKING", "COSTING");
    expect(resolveEffectiveTaskStatus(task, siblings)).toBe("CHECKING");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("upcoming");
  });

  it("Design Head: CHECKING sketch after approval gate is satisfied reads COMPLETED", () => {
    const siblings = [
      sibling("2", 2, "CHECKING", { name: "Sketch Creation", code: "SKETCH" }),
      sibling("3", 3, "COMPLETED", {
        name: "Sketch Approval",
        code: "SKETCH_APPROVAL",
        isApproval: true,
      }),
    ];
    const task = row("2", 2, "CHECKING", "SKETCH");
    expect(resolveEffectiveTaskStatus(task, siblings)).toBe("COMPLETED");
    expect(foldWaitingTaskToPersonalBucket(task, siblings)).toBe("completed");
  });

  it("Production Head / Management / Admin: display helper never prefers raw CHECKING over effective COMPLETED", () => {
    expect(
      resolveListItemDisplayStatus({ status: "CHECKING", effectiveStatus: "COMPLETED" }),
    ).toBe("COMPLETED");
  });
});
