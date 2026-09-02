/**
 * Dialog accessibility tests — Esc closes, outside click does not dismiss, Tab stays trapped.
 */
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, apiPostJson, createDesignViaApi, login } from "./helpers/auth";

function resetActiveTasks() {
  execSync("npx tsx scripts/reset-e2e-task-state.mjs", { stdio: "pipe" });
}

async function ensureSketchAssignedTask(page: import("@playwright/test").Page) {
  await login(page, USERS.designHead.email, USERS.designHead.password);
  await createDesignViaApi(page, `Dialog A11y ${Date.now()}`);
  await login(page, USERS.sketch.email, USERS.sketch.password);
}

test.describe("Dialog accessibility", () => {
  test.beforeEach(async ({ page }) => {
    resetActiveTasks();
    await ensureSketchAssignedTask(page);
    const tasks = await apiGetJson<Array<{ id: string; status: string }>>(page, "/api/tasks/my");
    const running = tasks.find((t) => t.status === "RUNNING");
    const assigned = tasks.find((t) => t.status === "ASSIGNED");
    if (!running && assigned) {
      await apiPostJson(page, `/api/tasks/${assigned.id}/start`, {});
    }
    await page.goto("/work/tasks");
    await expect(page.getByRole("heading", { name: /My Action Center/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hold task/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test.afterEach(() => {
    resetActiveTasks();
  });

  test("Hold dialog: Esc closes, overlay click does not close", async ({ page }) => {
    await page.getByRole("button", { name: /Hold task/i }).click();
    const dialog = page.getByRole("dialog", { name: /Hold Task/i });
    await expect(dialog).toBeVisible();

    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 5, y: 5 }, force: true });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Hold dialog: Tab cycles within dialog", async ({ page }) => {
    await page.getByRole("button", { name: /Hold task/i }).click();
    const dialog = page.getByRole("dialog", { name: /Hold Task/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focusedInDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(focusedInDialog).toBe(true);
  });
});
