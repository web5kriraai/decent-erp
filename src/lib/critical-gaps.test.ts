import { describe, expect, it } from "vitest";
import { MISTAKE_CORRECTION_TYPES } from "@/lib/kpi-metrics";

describe("assignment resolve options typing", () => {
  it("exports resolve helpers", async () => {
    const mod = await import("@/lib/services/assignment-service");
    expect(typeof mod.resolveEmployeeForRole).toBe("function");
    expect(typeof mod.resolveEmployeesForRoles).toBe("function");
    expect(typeof mod.resolveAssigneesForPatternTasks).toBe("function");
  });
});

describe("employee task lock", () => {
  it("exports advisory lock + running-task assert helpers", async () => {
    const mod = await import("@/lib/services/employee-task-lock");
    expect(typeof mod.lockEmployeeTaskMutation).toBe("function");
    expect(typeof mod.assertEmployeeHasNoOtherRunningTask).toBe("function");
  });
});

describe("assignment skill helpers (critical C3)", () => {
  it("exports skill-aware resolve helpers and stage map", async () => {
    const mod = await import("@/lib/services/assignment-service");
    expect(typeof mod.resolveEmployeeForRole).toBe("function");
    expect(typeof mod.resolveAssigneesForPatternTasks).toBe("function");
    expect(typeof mod.resolveAssigneeForDesignTask).toBe("function");
    expect(typeof mod.resolveSkillIdForTask).toBe("function");
    expect(typeof mod.resolveSkillIdForStageCode).toBe("function");
    expect(mod.STAGE_TO_SKILL_CODE.SKETCH).toBe("SKETCH");
    expect(mod.STAGE_TO_SKILL_CODE.PROD_HANDOFF).toBe("DESIGN_LEAD");
  });
});

describe("KPI mistake scope (critical C4)", () => {
  it("only MISTAKE is a penalty type", () => {
    expect([...MISTAKE_CORRECTION_TYPES]).toEqual(["MISTAKE"]);
  });
});
