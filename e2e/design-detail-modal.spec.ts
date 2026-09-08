import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers/auth";

/**
 * Smoke: Design Head opens dashboard design into detail modal tabs.
 * Relies on seeded demo data.
 */
test.describe("Design detail modal", () => {
  test("opens from kanban and shows tabs", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, USERS.designHead.email, USERS.designHead.password);

    const card = page.locator(".workflow-dash-card").first();
    if ((await card.count()) === 0) {
      test.skip(true, "No kanban designs in this environment");
      return;
    }

    await card.click();
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "KRA/KPI" }).click();
    await expect(page.getByText(/Current Team Contribution/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Costing" }).click();
    await expect(page.getByText(/Total Cost/i).first()).toBeVisible();
  });
});
