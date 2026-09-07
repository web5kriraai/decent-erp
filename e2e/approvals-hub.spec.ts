/**
 * Unified approvals hub — stage + ready-to-approve (Option A: no management decide chain).
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
  getDesign,
  getDesignTaskByCode,
  runWorkOrderThroughSampleReceive,
} from "./helpers/workflow";

const DEMO = "Demo@123";

type QueueItem = { designId: string; ideaRef?: string };

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
  test("stage and ready tabs; Design Head approve for production", async ({ page }) => {
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
    await expect(page.getByRole("tab", { name: /Ready to approve/i })).toBeVisible();
    const designRow = page.getByRole("row", { name: new RegExp(design.ideaRef) });
    await expect(designRow).toBeVisible();
    const requestLink = designRow.getByRole("link", { name: /Approve for production/i });
    await expect(requestLink).toBeVisible();
    await expect(requestLink).toHaveAttribute(
      "href",
      `/quality/approvals/request-sign-off/${design.id}`,
    );

    await requestLink.click();
    await expect(page).toHaveURL(new RegExp(`/quality/approvals/request-sign-off/${design.id}`));
    await expect(
      page.getByRole("heading", { name: new RegExp(`Approve for production · ${design.ideaRef}`) }),
    ).toBeVisible();
    await page.locator("#requesterRemark").fill(
      "E2E Design Head approve for production with full package context.",
    );
    await page.getByRole("button", { name: /Approve for production/i }).click();
    await expect(page).toHaveURL(new RegExp(`/designs/${design.id}`), { timeout: 20_000 });

    const approved = await getDesign(page, design.id);
    expect(approved.status).toBe("APPROVED");

    await login(page, USERS.checker.email, DEMO);
    const checkerPending = await apiGetJson<unknown[]>(page, "/api/approvals");
    expect(checkerPending).toEqual([]);

    await page.goto("/quality/approvals?tab=management");
    await expect(page).toHaveURL(/\/quality\/approvals\?tab=stage/, { timeout: 10_000 });
    await expect(page.getByRole("tab", { name: /Management sign-off/i })).toHaveCount(0);
  });
});
