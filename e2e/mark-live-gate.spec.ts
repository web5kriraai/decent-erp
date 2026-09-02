/**
 * Mark Live gate, permission denial, and concurrency conflict coverage.
 */
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";
import {
  addTaskArtifact,
  assignTaskToEmployee,
  completeAssignedTask,
  completeStageApproval,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
  submitManagementApprovals,
} from "./helpers/workflow";

const DEMO = "Demo@123";

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

async function releaseDesignWithoutLiveReview(page: import("@playwright/test").Page) {
  const roleMap: Record<string, string> = {
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
    PROD_HANDOFF: USERS.designHead.email,
    PROD_INSTRUCTION: USERS.production.email,
    PROD_RELEASE: USERS.production.email,
  };

  await login(page, USERS.designHead.email, DEMO);
  const design = await createDesignViaApi(page, `Mark live gate ${Date.now()}`);

  const snapshot = await getDesign(page, design.id);
  for (const task of snapshot.tasks) {
    const code = task.subProcess.code ?? "";
    const email = roleMap[code];
    if (!email || !["PENDING", "ASSIGNED"].includes(task.status)) continue;
    const id = await employeeIdFor(page, email);
    await assignTaskToEmployee(page, task.id, id);
  }

  for (const code of [
    "CONCEPT_REVIEW",
    "SKETCH",
    "PUNCH",
    "MAT_REQ",
    "FABRIC_ISSUE",
    "MACHINE_SAMPLE",
    "SAMPLE_RECEIVE",
  ] as const) {
    await login(page, roleMap[code], DEMO);
    const tasks = await apiGetJson<
      Array<{ id: string; status: string; design: { id: string }; subProcess: { code?: string } }>
    >(page, "/api/tasks/my");
    const mine = tasks.find(
      (t) => t.design.id === design.id && t.subProcess.code === code && t.status === "ASSIGNED",
    );
    if (mine) await completeAssignedTask(page, mine.id, `E2E ${code}`);

    if (code === "SKETCH") {
      await login(page, USERS.designHead.email, DEMO);
      const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
      if (approval?.status === "ASSIGNED") await completeStageApproval(page, approval.id);
    }
    if (code === "PUNCH") {
      await login(page, USERS.checker.email, DEMO);
      const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
      if (punchCheck?.status === "ASSIGNED") await completeStageApproval(page, punchCheck.id);
    }
  }

  const checklist = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/checklist");
  await login(page, USERS.checker.email, DEMO);
  const sampleMine = (await listMyTasks(page)).find(
    (t) => t.design.id === design.id && t.subProcess.code === "SAMPLE_CHECK" && t.status === "ASSIGNED",
  );
  expect(sampleMine).toBeTruthy();
  await completeAssignedTask(page, sampleMine!.id, "E2E sample approved", {
    sampleOutcome: "APPROVE",
    checklist: checklist.slice(0, 2).map((item) => ({ itemId: item.id, result: true })),
  });

  await login(page, USERS.costing.email, DEMO);
  await apiPostJson(page, `/api/designs/${design.id}/costs`, {
    costType: "MATERIAL",
    description: "Mark live gate costing",
    amount: 900,
  });

  await login(page, USERS.designHead.email, DEMO);
  const finalApproval = await getDesignTaskByCode(page, design.id, "FINAL_APPROVAL");
  if (finalApproval?.status === "ASSIGNED") await completeStageApproval(page, finalApproval.id);

  await submitManagementApprovals(page, design.id);

  await login(page, USERS.designHead.email, DEMO);
  const handoff = await getDesignTaskByCode(page, design.id, "PROD_HANDOFF");
  expect(handoff).toBeTruthy();
  await completeAssignedTask(page, handoff!.id, "E2E handoff");

  await login(page, USERS.production.email, DEMO);
  await apiPostJson(page, "/api/production/accept-handoff", { designId: design.id });

  const instruction = await getDesignTaskByCode(page, design.id, "PROD_INSTRUCTION");
  await completeAssignedTask(page, instruction!.id, "E2E instruction");

  const prodRelease = await getDesignTaskByCode(page, design.id, "PROD_RELEASE");
  await completeAssignedTask(page, prodRelease!.id, "E2E release");

  const released = await getDesign(page, design.id);
  expect(released.status).toBe("PRODUCTION_RELEASED");

  const liveReview = released.tasks.find((t) => t.subProcess.code === "LIVE_REVIEW");
  expect(liveReview?.status).not.toBe("COMPLETED");

  return design.id;
}

test.describe("Mark Live gate and guards", () => {
  test("mark live blocked until LIVE_REVIEW completes (API + UI)", async ({ page }) => {
    test.setTimeout(300_000);

    const designId = await releaseDesignWithoutLiveReview(page);

    await login(page, USERS.production.email, DEMO);
    const liveList = await apiGetJson<
      Array<{ id: string; liveReviewCompleted: boolean }>
    >(page, "/api/production/live");
    const row = liveList.find((d) => d.id === designId);
    expect(row).toBeTruthy();
    expect(row?.liveReviewCompleted).toBe(false);

    const blocked = await page.request.post("/api/production/live", {
      data: { designId },
      headers: { "Content-Type": "application/json" },
    });
    expect(blocked.ok()).toBe(false);

    await page.goto("/production/release");
    await expect(page.getByRole("heading", { name: /Production Release/i })).toBeVisible({
      timeout: 15_000,
    });

    const markLiveButton = page.getByRole("button", { name: "Mark Live" }).first();
    await expect(markLiveButton).toBeDisabled();
  });

  test("production head cannot mark live even after live review", async ({ page }) => {
    test.setTimeout(300_000);

    const designId = await releaseDesignWithoutLiveReview(page);

    await login(page, USERS.admin.email, USERS.admin.password);
    const liveTask = await getDesignTaskByCode(page, designId, "LIVE_REVIEW");
    expect(liveTask).toBeTruthy();
    if (liveTask && ["PENDING", "ASSIGNED"].includes(liveTask.status)) {
      const managementId = await employeeIdFor(page, USERS.management.email);
      await assignTaskToEmployee(page, liveTask.id, managementId);
    }

    await login(page, USERS.management.email, DEMO);
    const myTasks = await listMyTasks(page);
    const live = myTasks.find(
      (t) =>
        t.design.id === designId &&
        t.subProcess.code === "LIVE_REVIEW" &&
        t.status === "ASSIGNED",
    );
    expect(live).toBeTruthy();
    await completeAssignedTask(page, live!.id, "E2E live review");

    await login(page, USERS.production.email, DEMO);
    const denied = await page.request.post("/api/production/live", {
      data: { designId },
      headers: { "Content-Type": "application/json" },
    });
    expect(denied.status()).toBe(403);

    await login(page, USERS.management.email, DEMO);
    await apiPostJson(page, "/api/production/live", { designId });
    const liveDesign = await getDesign(page, designId);
    expect(liveDesign.status).toBe("LIVE");
  });

  test("non-production role cannot release to production", async ({ page }) => {
    await login(page, USERS.sketch.email, DEMO);
    const res = await page.request.post("/api/production/release", {
      data: { designId: "1" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("concurrent task end returns conflict on stale version", async ({ page }) => {
    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Concurrency ${Date.now()}`);

    await login(page, USERS.sketch.email, DEMO);
    const sketch = await getDesignTaskByCode(page, design.id, "SKETCH");
    expect(sketch).toBeTruthy();
    expect(sketch!.status).toBe("ASSIGNED");

    await apiPostJson(page, `/api/tasks/${sketch!.id}/start`, {});
    await addTaskArtifact(page, sketch!.id, "SKETCH_VERSION");
    const detail = await apiGetJson<{ version: number }>(page, `/api/tasks/${sketch!.id}`);

    const first = page.request.post(`/api/tasks/${sketch!.id}/end`, {
      data: {
        version: detail.version,
        outputRemark: "First end",
        completionStatus: "COMPLETED",
      },
      headers: { "Content-Type": "application/json" },
    });
    const second = page.request.post(`/api/tasks/${sketch!.id}/end`, {
      data: {
        version: detail.version,
        outputRemark: "Stale end",
        completionStatus: "COMPLETED",
      },
      headers: { "Content-Type": "application/json" },
    });

    const [r1, r2] = await Promise.all([first, second]);
    const statuses = [r1.status(), r2.status()];
    const okCount = statuses.filter((s) => s >= 200 && s < 300).length;
    expect(okCount).toBe(1);
    expect(statuses.some((s) => s === 409 || s === 422)).toBe(true);
  });
});
