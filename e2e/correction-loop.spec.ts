/**
 * Correction loops — sketch and punch send-back via stage approval reject API.
 */
import { expect, test, type Page } from "@playwright/test";
import { USERS, createDesignViaApi, login } from "./helpers/auth";
import {
  assignTaskToEmployee,
  completeAssignedTask,
  completeStageApproval,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
} from "./helpers/workflow";

const DEMO = "Demo@123";

async function employeeIdFor(page: Page, email: string) {
  const { apiGetJson } = await import("./helpers/auth");
  await login(page, USERS.admin.email, USERS.admin.password);
  const employees = await apiGetJson<Array<{ id: number; email: string }>>(
    page,
    "/api/admin/employees",
  );
  const row = employees.find((e) => e.email === email);
  if (!row) throw new Error(`Missing employee ${email}`);
  return row.id;
}

async function assignCoreRoles(page: Page, designId: string) {
  const map: Record<string, string> = {
    CONCEPT_REVIEW: USERS.designHead.email,
    SKETCH: USERS.sketch.email,
    SKETCH_APPROVAL: USERS.designHead.email,
    PUNCH: USERS.punch.email,
    PUNCH_CHECK: USERS.checker.email,
  };

  await login(page, USERS.designHead.email, DEMO);
  const design = await getDesign(page, designId);
  for (const task of design.tasks) {
    const code = task.subProcess.code ?? "";
    const email = map[code];
    if (!email) continue;
    if (!["PENDING", "ASSIGNED"].includes(task.status)) continue;
    const id = await employeeIdFor(page, email);
    await assignTaskToEmployee(page, task.id, id);
  }
}

async function completeTaskForUser(
  page: Page,
  email: string,
  designId: string,
  code: string,
) {
  await login(page, email, DEMO);
  const tasks = await listMyTasks(page);
  const mine = tasks.find(
    (t) => t.design.id === designId && t.subProcess.code === code && t.status === "ASSIGNED",
  );
  if (!mine) return false;
  await completeAssignedTask(page, mine.id, `E2E ${code}`);
  return true;
}

test.describe("Stage correction loops", () => {
  test("sketch correction loop — reject, rework, re-approve", async ({ page }) => {
    test.setTimeout(180_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Sketch loop ${Date.now()}`);
    await assignCoreRoles(page, design.id);

    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    let snapshot = await getDesign(page, design.id);
    const sketchApproval = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH_APPROVAL");
    expect(sketchApproval?.status).toBe("ASSIGNED");

    await login(page, USERS.designHead.email, DEMO);
    await completeStageApproval(
      page,
      sketchApproval!.id,
      "Sketch needs rework — proportions off",
      "CORRECTION_REQUIRED",
    );

    snapshot = await getDesign(page, design.id);
    const sketchAfterReject = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH");
    expect(["CORRECTION_REQUIRED", "ASSIGNED", "PENDING"].includes(sketchAfterReject?.status ?? "")).toBe(
      true,
    );

    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    snapshot = await getDesign(page, design.id);
    const approvalAgain = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH_APPROVAL");
    expect(approvalAgain?.status).toBe("ASSIGNED");

    await login(page, USERS.designHead.email, DEMO);
    await completeStageApproval(page, approvalAgain!.id, "Sketch approved after rework");

    snapshot = await getDesign(page, design.id);
    const approvedSketchGate = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH_APPROVAL");
    expect(approvedSketchGate?.status).toBe("COMPLETED");
  });

  test("punch correction loop — reject, rework, re-approve", async ({ page }) => {
    test.setTimeout(180_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Punch loop ${Date.now()}`);
    await assignCoreRoles(page, design.id);

    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    await login(page, USERS.designHead.email, DEMO);
    const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    if (approval?.status === "ASSIGNED") {
      await completeStageApproval(page, approval.id);
    }

    await completeTaskForUser(page, USERS.punch.email, design.id, "PUNCH");

    await login(page, USERS.checker.email, DEMO);
    const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
    expect(punchCheck?.status).toBe("ASSIGNED");

    await completeStageApproval(
      page,
      punchCheck!.id,
      "Punch alignment issue — send back",
      "REJECT",
    );

    let snapshot = await getDesign(page, design.id);
    const punchAfterReject = snapshot.tasks.find((t) => t.subProcess.code === "PUNCH");
    expect(["CORRECTION_REQUIRED", "ASSIGNED", "PENDING"].includes(punchAfterReject?.status ?? "")).toBe(
      true,
    );

    await completeTaskForUser(page, USERS.punch.email, design.id, "PUNCH");

    snapshot = await getDesign(page, design.id);
    const punchCheckAgain = snapshot.tasks.find((t) => t.subProcess.code === "PUNCH_CHECK");
    expect(punchCheckAgain?.status).toBe("ASSIGNED");

    await login(page, USERS.checker.email, DEMO);
    await completeStageApproval(page, punchCheckAgain!.id, "Punch approved after fix");

    snapshot = await getDesign(page, design.id);
    expect(snapshot.tasks.find((t) => t.subProcess.code === "PUNCH_CHECK")?.status).toBe("COMPLETED");
  });
});
