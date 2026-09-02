/**
 * Production return + API error shape acceptance.
 */
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";

test.describe("Production return and API errors", () => {
  test("production head cannot return before handoff completes", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Return gate ${Date.now()}`);

    await login(page, USERS.production.email, USERS.production.password);
    const res = await page.request.post("/api/production/return", {
      data: {
        designId: design.id,
        reasonCode: "TECHNICAL_FEASIBILITY",
        routeToSubProcessId: 1,
        remark: "Should fail — handoff not done",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.code).toBeTruthy();
    expect(json.error).toBeTruthy();
  });

  test("sketch designer cannot call production return API", async ({ page }) => {
    await login(page, USERS.sketch.email, USERS.sketch.password);
    const res = await page.request.post("/api/production/return", {
      data: {
        designId: "1",
        reasonCode: "OTHER",
        routeToSubProcessId: 1,
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("API errors include code and human message", async ({ page }) => {
    await login(page, USERS.sketch.email, USERS.sketch.password);
    const res = await page.request.get("/api/admin/employees");
    const json = await res.json();
    expect(res.status()).toBe(403);
    expect(json.code).toBe("PERMISSION_DENIED");
    expect(json.error).toMatch(/permission/i);
  });

  test("direct production release blocked when workflow tasks incomplete", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Release gate ${Date.now()}`);

    await login(page, USERS.costing.email, USERS.costing.password);
    await apiPostJson(page, `/api/designs/${design.id}/costs`, {
      costType: "MATERIAL",
      description: "E2E costing",
      amount: 500,
    });

    await login(page, USERS.production.email, USERS.production.password);
    const releaseRes = await page.request.post("/api/production/release", {
      data: { designId: design.id },
      headers: { "Content-Type": "application/json" },
    });
    expect(releaseRes.status()).toBe(422);
    const body = await releaseRes.json();
    expect(body.code).toBeTruthy();
  });
});
