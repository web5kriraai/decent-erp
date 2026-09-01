/**
 * Unified approvals hub — stage, ready-for-sign-off, and management tabs.
 */
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";
import {
  assignAllPendingTasks,
  completeStageApproval,
  completeTaskForUser,
  finalizeDevelopmentForSignOff,
  getDesignTaskByCode,
  requestDesignApproval,
  runWorkOrderThroughSampleReceive,
  submitApprovalAtLevel,
} from "./helpers/workflow";

const DEMO = "Demo@123";

type ApprovalLevelRow = { id: number; code: string; sequence: number; name: string };
type QueueItem = { designId: string; ideaRef?: string; currentLevel?: { code: string } };

async function employeeIdFor(page: import("@playwright/test").Page, email: string) {
  await login(page, USERS.admin.email, USERS.admin.password);
  const employees = await apiGetJson<Array<{ id: number; email: string }>>(
    page,
    "/api/admin/employees",
  );
  const row = employees.find((e) => e.email === email);
  if (!row) throw new Error(`Missing employee ${email}`);
  return row.id;
}

const ROLE_MAP: Record<string, string> = {
  CONCEPT_REVIEW: USERS.designHead.email,
  SKETCH: USERS.sketch.email,
  SKETCH_APPROVAL: USERS.designHead.email,
  PUNCH: USERS.punch.email,
  PUNCH_CHECK: USERS.checker.email,
  MAT_REQ: USERS.designHead.email,
  FABRIC_ISSUE: USERS.production.email,
  MACHINE_SAMPLE: USERS.machine.email,
  SAMPLE_RECEIVE: USERS.machine.email,
  SAMPLE_CHECK: USERS.checker.email,
  COSTING: USERS.costing.email,
  FINAL_APPROVAL: USERS.designHead.email,
};

test.describe("Approvals hub", () => {
  test("stage, ready, and management tabs reflect role-scoped queues", async ({ page }) => {
    test.setTimeout(240_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Approvals hub ${Date.now()}`);

    await assignAllPendingTasks(page, design.id, ROLE_MAP, employeeIdFor);
    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    await login(page, USERS.designHead.email, DEMO);
    const sketchApproval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(sketchApproval?.status).toBe("ASSIGNED");

    const stageQueue = await apiGetJson<QueueItem[]>(page, "/api/approvals?view=stage");
    expect(stageQueue.some((row) => row.designId === design.id)).toBe(true);

    await page.goto("/quality/approvals?tab=stage");
    await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Stage approvals/i })).toBeVisible();
    await expect(page.getByText(design.ideaRef)).toBeVisible();

    await completeStageApproval(page, sketchApproval!.id, "Sketch approved from hub E2E");

    await runWorkOrderThroughSampleReceive(page, design.id, ROLE_MAP, employeeIdFor, {
      fromCode: "PUNCH",
      assignFirst: false,
    });

    const sampleDone = await completeTaskForUser(
      page,
      USERS.checker.email,
      design.id,
      "SAMPLE_CHECK",
      { sampleOutcome: "APPROVE" },
    );
    expect(sampleDone).toBe(true);

    await finalizeDevelopmentForSignOff(page, design.id, employeeIdFor, {
      costAmount: 750,
      costDescription: "Hub E2E costing",
    });

    const readyQueue = await apiGetJson<QueueItem[]>(page, "/api/approvals?view=ready");
    expect(readyQueue.some((row) => row.designId === design.id)).toBe(true);

    await page.goto("/quality/approvals?tab=ready");
    await expect(page.getByRole("tab", { name: /Ready for sign-off/i })).toBeVisible();
    const designRow = page.getByRole("row", { name: new RegExp(design.ideaRef) });
    await expect(designRow).toBeVisible();
    await expect(designRow.getByRole("button", { name: /Request approval/i })).toBeVisible();

    await requestDesignApproval(page, design.id);

    await login(page, USERS.checker.email, DEMO);
    const checkerQueue = await apiGetJson<QueueItem[]>(page, "/api/approvals");
    expect(checkerQueue.some((row) => row.designId === design.id)).toBe(true);

    await login(page, USERS.designHead.email, DEMO);
    const designHeadQueueBefore = await apiGetJson<QueueItem[]>(page, "/api/approvals");
    expect(designHeadQueueBefore.some((row) => row.designId === design.id)).toBe(false);

    await page.goto("/quality/approvals?tab=management");
    await expect(page.getByRole("tab", { name: /Management sign-off/i })).toBeVisible();

    const levels = await apiGetJson<ApprovalLevelRow[]>(page, "/api/approvals?view=levels");
    const checkerLevel = levels.find((l) => l.code === "CHECKER_APPROVAL");
    expect(checkerLevel).toBeTruthy();
    await submitApprovalAtLevel(page, design.id, checkerLevel!, "APPROVED");

    await login(page, USERS.designHead.email, DEMO);
    const designHeadQueue = await apiGetJson<QueueItem[]>(page, "/api/approvals");
    expect(designHeadQueue.some((row) => row.designId === design.id)).toBe(true);

    await page.goto("/quality/approvals?tab=management");
    await expect(page.getByText(design.ideaRef)).toBeVisible();
    await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
  });
});
