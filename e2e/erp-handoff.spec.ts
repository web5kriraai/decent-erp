import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, login } from "./helpers/auth";

test.describe("ERP integration (Phase 5)", () => {
  test("integration status returns simulated mode by default", async ({ page }) => {
    await login(page, USERS.production.email, USERS.production.password);
    const status = await apiGetJson<{
      mode: string;
      syncOrder: string[];
      primaryModules: string[];
      downstreamModules: string[];
    }>(page, "/api/erp/integration-status");

    expect(status.mode).toBe("simulated");
    expect(status.syncOrder.length).toBeGreaterThanOrEqual(8);
    expect(status.primaryModules).toContain("GREY_MATERIAL");
    expect(status.downstreamModules).toContain("EMBROIDERY");
  });

  test("handoffs list is accessible to production head", async ({ page }) => {
    await login(page, USERS.production.email, USERS.production.password);
    const handoffs = await apiGetJson<Array<{ erpModule: string; status: string }>>(
      page,
      "/api/production/handoffs",
    );
    expect(Array.isArray(handoffs)).toBe(true);
  });
});
