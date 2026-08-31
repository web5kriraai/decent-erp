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

async function ensureDesignHasImage(page: Page, designId: string) {
  const res = await page.request.post(`/api/designs/${designId}/images`, {
    multipart: {
      file: {
        name: "e2e-sketch.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      },
    },
  });
  if (res.ok()) return;

  // MinIO may be unavailable in local/dev; seed a DB row so file-required end still works.
  execSync(`npx tsx scripts/seed-e2e-design-image.mjs ${designId}`, { stdio: "pipe" });
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
    // --- Cross-role setup: design head creates work, sketch executes ---
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `UI Workday ${Date.now()}`, {
      conceptNote: "Playwright workday UI flow",
    });
    expect(design.id).toBeTruthy();

    await login(page, USERS.sketch.email, USERS.sketch.password);

    const tasks = await apiGetJson<
      Array<{
        id: string;
        status: string;
        version: number;
        design: { id: string; ideaRef: string };
        subProcess: { id: number; name: string; code?: string };
      }>
    >(page, "/api/tasks/my");

    const assignedTask = tasks.find((t) => t.status === "ASSIGNED");
    if (!assignedTask) {
      test.skip(true, "No ASSIGNED task for sketch designer after design create");
      return;
    }

    await page.goto("/work/tasks");
    await expect(page.getByRole("heading", { name: /My Tasks/i })).toBeVisible();

    // --- Start ---
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
    await expect(page.getByRole("button", { name: /Hold task/i })).toBeVisible();

    // --- Live timer ticks without refresh ---
    const timer = page.locator(".timer-display");
    await expect(timer).toBeVisible();
    const t0 = parseTimer(await timer.innerText());
    await page.waitForTimeout(2200);
    const t1 = parseTimer(await timer.innerText());
    expect(t1).toBeGreaterThan(t0);

    // --- Hold with human-readable reason label (not raw id) ---
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

    const reasonTriggerText = (await holdDialog.locator("#holdReason").innerText()).trim();
    expect(reasonTriggerText).not.toMatch(/^\d+$/);
    expect(reasonTriggerText).toContain(lunch.name);

    await holdDialog.getByRole("button", { name: /Confirm Hold/i }).click();
    await expect(holdDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".timer-status")).toContainText(/ON HOLD/i, { timeout: 15_000 });

    // --- Resume ---
    await page.getByRole("button", { name: /Resume task/i }).click();
    await expect(page.locator(".timer-status")).toContainText(/RUNNING/i, { timeout: 15_000 });

    // --- File required for SKETCH: upload so end can succeed ---
    const runningDetail = await apiGetJson<{
      id: string;
      designId: string;
      design: { id: string };
      version: number;
      status: string;
    }>(page, `/api/tasks/${assignedTask.id}`);
    const designId = runningDetail.designId ?? runningDetail.design.id;
    await ensureDesignHasImage(page, designId);

    // --- End / checklist gate ---
    await page.getByRole("button", { name: /End Task/i }).click();
    const endDialog = page.getByRole("dialog", { name: /Complete Task/i });
    await expect(endDialog).toBeVisible();

    await endDialog.locator("#endRemark").fill("E2E workday UI completion remark");

    const checklistSection = endDialog.getByText(/Quality Checklist/i);
    const hasChecklist = await checklistSection.isVisible().catch(() => false);

    const submitBtn = endDialog.getByRole("button", { name: /Submit Completion/i });

    if (hasChecklist) {
      await expect(submitBtn).toBeDisabled();
      await endDialog.getByRole("button", { name: /Mark all as passed/i }).click();
      await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    } else {
      await expect(submitBtn).toBeEnabled();
    }

    await submitBtn.click();
    await expect(endDialog).not.toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".timer-status")).toContainText(/IDLE/i, { timeout: 15_000 });

    const finished = await apiGetJson<{ status: string }>(page, `/api/tasks/${assignedTask.id}`);
    expect(["CHECKING", "COMPLETED"]).toContain(finished.status);

    // --- Global search opens without subscribe crash ---
    await page.keyboard.press("Control+k");
    const searchDialog = page.getByRole("dialog", { name: /Search Decent ERP/i });
    await expect(searchDialog).toBeVisible({ timeout: 10_000 });
    await expect(searchDialog.getByPlaceholder(/Search designs/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchDialog).not.toBeVisible();
  });
});
