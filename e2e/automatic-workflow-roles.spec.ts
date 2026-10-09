/**
 * Automatic workflow pattern assigns every stage to the pattern role,
 * and checker correction returns the work to that same role.
 */
import { expect, test, type Page } from "@playwright/test";
import { USERS, apiGetJson, createDesignViaApi, login } from "./helpers/auth";
import {
  completeAssignedTask,
  completeStageApproval,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
} from "./helpers/workflow";

const ROLE_BY_STAGE: Record<string, string> = {
  CONCEPT_REVIEW: "DESIGN_HEAD",
  SKETCH: "SKETCH_DESIGNER",
  SKETCH_APPROVAL: "DESIGN_HEAD",
  PUNCH: "PUNCHING_DESIGNER",
  PUNCH_CHECK: "SAMPLE_CHECKER",
  MAT_REQ: "DESIGN_HEAD",
  FABRIC_ISSUE: "PRODUCTION_HEAD",
  MACHINE_SAMPLE: "MACHINE_OPERATOR",
  SAMPLE_CUTTING: "MACHINE_OPERATOR",
  SAMPLE_STITCHING: "MACHINE_OPERATOR",
  SAMPLE_RECEIVE: "MACHINE_OPERATOR",
  SAMPLE_CHECK: "SAMPLE_CHECKER",
  COSTING: "COSTING_TEAM",
  FINAL_APPROVAL: "DESIGN_HEAD",
  PROD_HANDOFF: "DESIGN_HEAD",
  PROD_INSTRUCTION: "PRODUCTION_HEAD",
  PROD_RELEASE: "PRODUCTION_HEAD",
  LIVE_REVIEW: "MANAGEMENT",
};

const EMAIL_BY_ROLE: Record<string, string> = {
  DESIGN_HEAD: USERS.designHead.email,
  SKETCH_DESIGNER: USERS.sketch.email,
  PUNCHING_DESIGNER: USERS.punch.email,
  MACHINE_OPERATOR: USERS.machine.email,
  SAMPLE_CHECKER: USERS.checker.email,
  COSTING_TEAM: USERS.costing.email,
  PRODUCTION_HEAD: USERS.production.email,
  MANAGEMENT: USERS.management.email,
};

type EmployeeRow = {
  id: number;
  email: string;
  role: { id: number; code: string };
};

type AssignedTask = {
  id: string;
  status: string;
  assignedEmployeeId?: number | null;
  assignedRoleId?: number | null;
  subProcess: { code?: string };
};

async function employeesByEmail(page: Page) {
  await login(page, USERS.admin.email, USERS.admin.password);
  const rows = await apiGetJson<EmployeeRow[]>(page, "/api/admin/employees");
  return new Map(rows.map((row) => [row.email, row]));
}

async function completeAsAssignee(
  page: Page,
  email: string,
  password: string,
  designId: string,
  code: string,
) {
  await login(page, email, password);
  const tasks = await listMyTasks(page);
  const mine = tasks.find(
    (task) =>
      task.design.id === designId &&
      task.subProcess.code === code &&
      ["ASSIGNED", "CORRECTION_REQUIRED", "PENDING"].includes(task.status),
  );
  expect(mine, `${code} should be on ${email} without a manual reassignment`).toBeTruthy();
  if (mine!.subProcess.isApproval) {
    await completeStageApproval(page, mine!.id, `E2E ${code}`);
    return;
  }
  await completeAssignedTask(page, mine!.id, `E2E ${code}`);
}

test.describe("Automatic workflow pattern roles", () => {
  test("full pattern assigns every role, and checker correction returns punch to the punching designer", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Auto roles ${Date.now()}`);

    const byEmail = await employeesByEmail(page);
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const detail = await getDesign(page, design.id);
    const tasks = detail.tasks as AssignedTask[];

    expect(tasks.map((task) => task.subProcess.code)).toEqual(Object.keys(ROLE_BY_STAGE));

    for (const task of tasks) {
      const code = task.subProcess.code ?? "";
      const roleCode = ROLE_BY_STAGE[code];
      const expected = byEmail.get(EMAIL_BY_ROLE[roleCode]);
      expect(expected, `demo employee for ${roleCode}`).toBeTruthy();
      expect(task.assignedEmployeeId, `${code} assignee`).toBe(expected!.id);
      expect(task.assignedRoleId, `${code} role`).toBe(expected!.role.id);
    }

    const concept = tasks.find((task) => task.subProcess.code === "CONCEPT_REVIEW");
    if (concept && concept.status !== "COMPLETED") {
      await completeAsAssignee(
        page,
        USERS.designHead.email,
        USERS.designHead.password,
        design.id,
        "CONCEPT_REVIEW",
      );
    }

    await completeAsAssignee(
      page,
      USERS.sketch.email,
      USERS.sketch.password,
      design.id,
      "SKETCH",
    );

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const sketchApproval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(sketchApproval?.status).toBe("ASSIGNED");
    expect(sketchApproval?.assignedEmployeeId).toBe(byEmail.get(USERS.designHead.email)!.id);
    await completeStageApproval(page, sketchApproval!.id, "Sketch approved");

    await completeAsAssignee(
      page,
      USERS.punch.email,
      USERS.punch.password,
      design.id,
      "PUNCH",
    );

    await login(page, USERS.checker.email, USERS.checker.password);
    const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
    expect(punchCheck?.status).toBe("ASSIGNED");
    expect(punchCheck?.assignedEmployeeId).toBe(byEmail.get(USERS.checker.email)!.id);

    await completeStageApproval(
      page,
      punchCheck!.id,
      "Punch alignment needs correction",
      "CORRECTION_REQUIRED",
    );

    const afterCorrection = await getDesign(page, design.id);
    const punchRework = (afterCorrection.tasks as AssignedTask[]).find(
      (task) => task.subProcess.code === "PUNCH",
    );
    expect(punchRework?.status).toBe("CORRECTION_REQUIRED");
    expect(punchRework?.assignedEmployeeId).toBe(byEmail.get(USERS.punch.email)!.id);

    const checkerTasks = await listMyTasks(page);
    expect(
      checkerTasks.some(
        (task) => task.design.id === design.id && task.subProcess.code === "PUNCH",
      ),
    ).toBe(false);

    await completeAsAssignee(
      page,
      USERS.punch.email,
      USERS.punch.password,
      design.id,
      "PUNCH",
    );

    await login(page, USERS.checker.email, USERS.checker.password);
    const punchCheckAgain = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
    expect(punchCheckAgain?.status).toBe("ASSIGNED");
    expect(punchCheckAgain?.assignedEmployeeId).toBe(byEmail.get(USERS.checker.email)!.id);
    await completeStageApproval(page, punchCheckAgain!.id, "Punch approved after correction");

    const closed = await getDesign(page, design.id);
    expect(
      (closed.tasks as AssignedTask[]).find((task) => task.subProcess.code === "PUNCH_CHECK")
        ?.status,
    ).toBe("COMPLETED");
  });
});
