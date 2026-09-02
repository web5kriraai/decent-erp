/**
 * Action Center: badge / tab / hint follow effectiveStatus, not raw DB status.
 * Run: npm run test:e2e -- e2e/action-center-status-display.spec.ts
 */
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, createDesignViaApi, login } from "./helpers/auth";
import { completeAssignedTask, listMyTasks } from "./helpers/workflow";

function resetActiveTasks() {
  execSync("npx tsx scripts/reset-e2e-task-state.mjs", { stdio: "pipe" });
}

type ActionCenterPayload = {
  upcoming: Array<{
    id: string;
    status: string;
    effectiveStatus?: string;
    isWaitingOnOthers?: boolean;
    waitingOnStage?: string | null;
    waitingOnAssignee?: string | null;
    design: { id: string; ideaRef: string };
    subProcess: { code?: string; name: string };
  }>;
  completed: Array<{
    id: string;
    status: string;
    effectiveStatus?: string;
    design: { id: string };
    subProcess: { code?: string; name: string };
  }>;
};

test.describe("Action Center status display", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeEach(() => {
    resetActiveTasks();
  });

  test.afterEach(() => {
    resetActiveTasks();
  });

  test("sketch CHECKING lands on Upcoming with waiting badge and hint", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const design = await createDesignViaApi(page, `AC Display ${Date.now()}`, {
      conceptNote: "Action center status display",
    });

    await login(page, USERS.sketch.email, USERS.sketch.password);
    const mine = await listMyTasks(page);
    const sketch = mine.find(
      (t) => t.design.id === design.id && t.subProcess.code === "SKETCH" && t.status === "ASSIGNED",
    );
    expect(sketch).toBeTruthy();
    await completeAssignedTask(page, sketch!.id, "E2E sketch submit for display", {
      completionStatus: "CHECKING",
    });

    const center = await apiGetJson<ActionCenterPayload>(page, "/api/tasks/action-center");
    const upcoming = center.upcoming.find(
      (t) => t.design.id === design.id && t.subProcess.code === "SKETCH",
    );
    expect(upcoming).toBeTruthy();
    expect(upcoming?.status).toBe("CHECKING");
    expect(upcoming?.effectiveStatus).toBe("CHECKING");
    expect(upcoming?.isWaitingOnOthers).toBe(true);
    expect(center.completed.some((t) => t.id === upcoming?.id)).toBe(false);

    await page.goto("/work/tasks");
    await expect(page.getByRole("heading", { name: /My Action Center/i })).toBeVisible();
    await page.getByRole("tab", { name: /Upcoming/i }).click();

    const row = page.locator("li.action-center-list-item", { hasText: /Sketch Creation/i }).first();
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/action-center-list-item--waiting/);
    await expect(row.getByLabel("Status: CHECKING")).toBeVisible();
    await expect(row.getByText(/Submitted · waiting on/i)).toBeVisible();
  });
});
