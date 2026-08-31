/**
 * UI happy-path workday flow — catches timer / hold-label / checklist / command-palette regressions.
 * Run: npm run test:e2e -- e2e/workday-ui-flow.spec.ts
 */
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function resetActiveTasks() {
  execSync("npx tsx scripts/reset-e2e-task-state.mjs", { stdio: "pipe" });
}

function parseTimer(text: string): number {
  const m = text.trim().match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Unexpected timer text: ${text}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function ensureTaskArtifact(page: Page, taskId: string, designId: string) {
  const upload = await page.request.post(`/api/designs/${designId}/images`, {
    multipart: {
      file: {
        name: "e2e-sketch.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      },
    },
  });

  let storageKey: string | undefined;
  let fileName = "e2e-sketch.png";
  if (upload.ok()) {
    const json = await upload.json();
    storageKey = json.data?.storageKey;
    fileName = json.data?.fileName ?? fileName;
  } else {
    execSync(`npx tsx scripts/seed-e2e-design-image.mjs ${designId}`, { stdio: "pipe" });
    storageKey = `e2e/${designId}/seed.png`;
  }

  await apiPostJson(page, `/api/tasks/${taskId}/artifacts`, {
    artifactType: "SKETCH_VERSION",
    fileName,
    storageKey,
  });
}

/** Complete ASSIGNED prior-sequence tasks for design head so dependency gate allows sketch. */
async function completePriorDesignHeadTasks(page: Page, designId: string) {
  const tasks = await apiGetJson<
    Array<{
      id: string;
      status: string;
      version: number;
      design: { id: string };
      subProcess: { code?: string; name: string };
      dependencySequence?: number | null;
      sequence?: number;
    }>
  >(page, "/api/tasks/my");

  const mine = tasks.filter(
    (t) =>
      t.design.id === designId &&
      ["ASSIGNED", "PENDING"].includes(t.status) &&
      (t.subProcess.code === "CONCEPT_REVIEW" || /concept|review|approval/i.test(t.subProcess.name)),
  );

  for (const task of mine) {
    if (task.status === "ASSIGNED" || task.status === "PENDING") {
      await apiPostJson(page, `/api/tasks/${task.id}/start`, {});
      const detail = await apiGetJson<{ version: number }>(page, `/api/tasks/${task.id}`);
      await apiPostJson(page, `/api/tasks/${task.id}/end`, {
        version: detail.version,
        outputRemark: "E2E prior stage complete",
        completionStatus: "COMPLETED",
      });
    }
  }
}

test.describe("Workday UI flow (end-to-end)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeEach(() => {
    resetActiveTasks();
  });

  test.afterEach(() => {
    resetActiveTasks();
  });

  test("start → live timer → hold label → resume → checklist end → search", async ({
    page,
  }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `UI Workday ${Date.now()}`, {
      conceptNote: "Playwright workday UI flow",
    });
    expect(design.id).toBeTruthy();
    await completePriorDesignHeadTasks(page, design.id);

    // Illegal status jump blocked by FSM
    const jump = await page.request.patch(`/api/designs/${design.id}/status`, {
      data: { status: "PRODUCTION_RELEASED", version: 1 },
    });
    expect(jump.status()).toBe(422);

    await login(page, USERS.sketch.email, USERS.sketch.password);

    const tasks = await apiGetJson<
      Array<{
        id: string;
        status: string;
        version: number;
        design: { id: string; ideaRef: string };
        subProcess: { id: number; name: string; code?: string; isFileRequired?: boolean };
      }>
    >(page, "/api/tasks/my");

    const assignedTask = tasks.find((t) => t.status === "ASSIGNED");
    if (!assignedTask) {
      test.skip(true, "No ASSIGNED task for sketch designer after design create");
      return;
    }

    await page.goto("/work/tasks");
    await expect(page.getByRole("heading", { name: /My Tasks/i })).toBeVisible();

    const card = page.locator("article.task-card", { hasText: assignedTask.design.ideaRef }).first();
    const startBtn = card.getByRole("button", { name: /^Start$/i });
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    } else {
      await apiPostJson(page, `/api/tasks/${assignedTask.id}/start`, {});
      await page.reload();
      await expect(page.getByRole("heading", { name: /My Tasks/i })).toBeVisible();
    }

    await expect(page.locator(".timer-widget")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".timer-status")).toContainText(/RUNNING/i);

    const timer = page.locator(".timer-display");
    await expect(timer).toBeVisible();
    const t0 = parseTimer(await timer.innerText());
    await page.waitForTimeout(2200);
    const t1 = parseTimer(await timer.innerText());
    expect(t1).toBeGreaterThan(t0);

    const holdReasons = await apiGetJson<Array<{ id: number; code: string; name: string }>>(
      page,
      "/api/masters/hold-reasons",
    );
    const lunch = holdReasons.find((r) => r.code === "LUNCH") ?? holdReasons[0];
    expect(lunch).toBeTruthy();

    await page.getByRole("button", { name: /Hold task/i }).click();
    const holdDialog = page.getByRole("dialog", { name: /Hold Task/i });
    await expect(holdDialog).toBeVisible();
    await holdDialog.locator("#holdReason").click();
    await page.getByRole("option", { name: new RegExp(lunch.name, "i") }).click();
    expect((await holdDialog.locator("#holdReason").innerText()).trim()).toContain(lunch.name);
    await holdDialog.getByRole("button", { name: /Confirm Hold/i }).click();
    await expect(holdDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".timer-status")).toContainText(/ON HOLD/i, { timeout: 15_000 });

    await page.getByRole("button", { name: /Resume task/i }).click();
    await expect(page.locator(".timer-status")).toContainText(/RUNNING/i, { timeout: 15_000 });

    const taskMeta = await apiGetJson<{
      id: string;
      designId: string;
      design: { id: string };
      version: number;
      subProcess: { isFileRequired?: boolean; code?: string };
    }>(page, `/api/tasks/${assignedTask.id}`);
    const designId = taskMeta.designId ?? taskMeta.design.id;
    const needsFile = !!taskMeta.subProcess?.isFileRequired;

    await page.getByRole("button", { name: /End Task/i }).click();
    const endDialog = page.getByRole("dialog", { name: /Complete Task/i });
    await expect(endDialog).toBeVisible();
    await endDialog.locator("#endRemark").fill("E2E workday UI completion remark");

    const checklistSection = endDialog.getByText(/Quality Checklist/i);
    const hasChecklist = await checklistSection.isVisible().catch(() => false);
    if (hasChecklist) {
      await endDialog.getByRole("button", { name: /Mark all as passed/i }).click();
    }

    const submitBtn = endDialog.getByRole("button", {
      name: /Submit Completion|Submit with notes/i,
    });
    if (needsFile) {
      await expect(endDialog.getByRole("alert")).toContainText(/requires at least one uploaded file/i);
      await expect(submitBtn).toBeDisabled();
      await endDialog.getByRole("button", { name: /Cancel/i }).click();
      await expect(endDialog).not.toBeVisible();

      await ensureTaskArtifact(page, assignedTask.id, designId);
      await page.reload();
      await expect(page.locator(".timer-widget")).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: /End Task/i }).click();
      await expect(endDialog).toBeVisible();
      await endDialog.locator("#endRemark").fill("E2E workday UI completion remark");
      if (hasChecklist) {
        await endDialog.getByRole("button", { name: /Mark all as passed/i }).click();
      }
    }

    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();
    await expect(endDialog).not.toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".timer-status")).toContainText(/IDLE/i, { timeout: 15_000 });

    const finished = await apiGetJson<{ status: string }>(page, `/api/tasks/${assignedTask.id}`);
    expect(["CHECKING", "COMPLETED"]).toContain(finished.status);

    await page.keyboard.press("Control+k");
    const searchDialog = page.getByRole("dialog", { name: /Search Decent ERP/i });
    await expect(searchDialog).toBeVisible({ timeout: 10_000 });
    await expect(searchDialog.getByPlaceholder(/Search designs/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchDialog).not.toBeVisible();
  });
});
